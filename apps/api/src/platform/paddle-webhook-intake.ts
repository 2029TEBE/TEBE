/**
 * Paddle notification ingress — intentionally available only in disposable CI.
 * A signed event is never a paid entitlement until merchant sandbox and
 * per-tenant operational release gates are approved.
 */
import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db, withTenantSerializable } from '@pmo/db';
import { ensureDisposableWriter, recordVerifiedPaddleSandboxSettlement, verifyRawPaddleSignature } from './paddle-ledger-writer';

const transactionPattern=/^txn_[a-z0-9]{26}$/;
const eventPattern=/^evt_[a-z0-9]{26}$/;
const adjustmentPattern=/^adj_[a-z0-9]{26}$/;
const actions=new Set(['refund','credit','chargeback','chargeback_warning','chargeback_reverse','chargeback_warning_reverse','credit_reverse']);
const statuses=new Set(['pending_approval','approved','rejected','reversed']);
const rows=(v: unknown)=>v as Array<Record<string,any>>;

@Injectable()
export class PaddleWebhookIntake {
  async accept(rawBody: Buffer | undefined, signature: string | undefined) {
    // Never persist callbacks in staging/production, even with valid secrets.
    try { ensureDisposableWriter(process.env); }
    catch { throw new ServiceUnavailableException('Paddle collection disabled'); }
    const secret=process.env.PADDLE_WEBHOOK_SECRET;
    if (!secret || !Buffer.isBuffer(rawBody) || !rawBody.length ||
        rawBody.length>65536 || typeof signature!=='string')
      throw new UnauthorizedException('Paddle signed raw body required');
    if (!verifyRawPaddleSignature(rawBody,signature,secret,Math.floor(Date.now()/1000)))
      throw new UnauthorizedException('Paddle signature rejected');

    let event: any;
    try { event=JSON.parse(rawBody.toString('utf8')); }
    catch { throw new BadRequestException('Invalid Paddle JSON'); }
    if (!event || Array.isArray(event) || typeof event!=='object' ||
        !eventPattern.test(event.event_id??'') ||
        !event.data || typeof event.data!=='object' || Array.isArray(event.data))
      throw new BadRequestException('Invalid Paddle event');
    const completed=event.event_type==='transaction.completed';
    const adjustment=['adjustment.created','adjustment.updated'].includes(event.event_type);
    const transaction=completed?event.data.id:adjustment?event.data.transaction_id:null;
    if (typeof transaction!=='string' || !transactionPattern.test(transaction))
      throw new ServiceUnavailableException('Unsupported Paddle notification');

    // Derive tenant ONLY from a preexisting server-owned transaction ID
    // after verifying the Paddle signature; never use custom_data to select it.
    const lookup=rows(await db.execute(sql`
      SELECT public.pmo_paddle_tenant_for_transaction(${transaction}) AS "tenantId"`));
    const tenant=lookup[0]?.tenantId;
    if (typeof tenant!=='string' || !/^[a-f0-9-]{36}$/i.test(tenant))
      throw new ServiceUnavailableException('Unknown Paddle transaction');

    if(completed){
      const settled=await recordVerifiedPaddleSandboxSettlement({
        tenantId:tenant,rawBody,paddleSignature:signature,endpointSecret:secret,
      });
      return {received:true,duplicate:settled.duplicate,grantEntitlement:false};
    }

    const item=event.data;
    if(!adjustmentPattern.test(item.id??'') ||
       !actions.has(item.action) || !statuses.has(item.status) ||
       !/^[A-Z]{3}$/.test(item.currency_code??''))
      throw new BadRequestException('Invalid Paddle adjustment');

    const digest=createHash('sha256').update(rawBody).digest('hex');
    return withTenantSerializable(tenant, async tx=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(1212,hashtext(${tenant}))`);
      const settlement=rows(await tx.execute(sql`
        SELECT id,currency FROM billing_paddle_settlements
        WHERE tenant_id=${tenant} AND paddle_transaction_id=${transaction} LIMIT 1`))[0];
      if(!settlement || settlement.currency!==item.currency_code)
        throw new ServiceUnavailableException('Settlement not available for adjustment');
      const existing=rows(await tx.execute(sql`
        SELECT id,payload_sha256 AS hash,settlement_id AS "settlementId"
        FROM billing_paddle_adjustment_receipts
        WHERE tenant_id=${tenant} AND paddle_event_id=${event.event_id}`))[0];
      if(existing){
        if(existing.hash!==digest || existing.settlementId!==settlement.id)
          throw new BadRequestException('Conflicting adjustment replay');
        return {received:true,duplicate:true,grantEntitlement:false};
      }
      const inserted=rows(await tx.execute(sql`
        INSERT INTO billing_paddle_adjustment_receipts
          (tenant_id,settlement_id,paddle_event_id,paddle_adjustment_id,
           paddle_transaction_id,event_type,action,adjustment_status,payload_sha256)
        VALUES (${tenant},${settlement.id},${event.event_id},${item.id},
                ${transaction},${event.event_type},${item.action},${item.status},${digest})
        RETURNING id`))[0];
      if(!inserted?.id) throw new ServiceUnavailableException('Adjustment not recorded');
      // Every adjustment requires explicit reconciliation and authorization.
      return {received:true,duplicate:false,grantEntitlement:false};
    });
  }
}
