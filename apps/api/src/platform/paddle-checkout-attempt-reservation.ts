/** Durable PRE-Paddle attempt reservation; disposable CI ONLY.
 * This write commits BEFORE a remote Paddle POST is ever considered.
 * A timeout leaves the attempt locked for reconciliation; no auto retry.
 * No customer route, no Paddle call and no entitlement change.
 */
import { sql } from 'drizzle-orm';
import { withTenantSerializable } from '@pmo/db';
import { ensureDisposableWriter } from './paddle-ledger-writer';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE='pri_01m6x7w5zy16nktzjwg2ezas2d';
const rows=(value:unknown)=>value as Array<Record<string,any>>;
const refuse=(reason:string):never=>{throw new Error('Paddle precreate reservation refused: '+reason);};

type Input={
 source:'locked-tenant-record'; provider:'paddle'; environment:'sandbox';
 tenantId:string; attemptId:string; invoiceId:string;
 subscriptionId:string; planId:string; expiresAt:number;
 paddlePriceId:string; amountMinor:4900; currency:'USD';
};

export async function reserveDisposablePaddleAttempt(input:Input):Promise<{
 reserved:true; attemptId:string; mayCreateRemoteTransaction:false;
 checkoutAllowed:false; entitlementGranted:false;
}> {
 ensureDisposableWriter(process.env);
 if(!input||input.source!=='locked-tenant-record'||
   input.provider!=='paddle'||input.environment!=='sandbox'||
   ![input.tenantId,input.attemptId,input.invoiceId,input.subscriptionId,input.planId]
     .every(x=>typeof x==='string'&&UUID.test(x))||
   input.paddlePriceId!==PRICE||input.amountMinor!==4900||input.currency!=='USD'||
   !Number.isSafeInteger(input.expiresAt)||
   input.expiresAt<=Date.now()||
   input.expiresAt>Date.now()+15*60*1000)
   refuse('invalid_server_reservation');
 const tenant=input.tenantId;
 return withTenantSerializable(tenant,async tx=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(1212,hashtext(${tenant}))`);
   const invoice=rows(await tx.execute(sql`
     SELECT i.id AS "invoiceId",i.status AS "invoiceStatus",
       i.amount_minor AS "amountMinor",i.currency,
       i.subscription_id AS "invoiceSubscriptionId",
       s.id AS "subscriptionId",s.plan_id AS "planId",
       s.status AS "subscriptionStatus",s.cancel_at_period_end AS "cancelAtPeriodEnd",
       p.price_minor AS "planAmountMinor",p.currency AS "planCurrency",
       p.billing_interval AS "billingInterval"
     FROM billing_invoices i
     JOIN tenant_subscriptions s ON s.tenant_id=i.tenant_id AND s.id=i.subscription_id
     JOIN subscription_plans p ON p.id=s.plan_id
     WHERE i.tenant_id=${tenant} AND i.id=${input.invoiceId}
     FOR UPDATE OF i,s`))[0];
   if(!invoice||invoice.invoiceId!==input.invoiceId||
     invoice.invoiceStatus!=='open'||invoice.invoiceSubscriptionId!==input.subscriptionId||
     invoice.subscriptionId!==input.subscriptionId||invoice.planId!==input.planId||
     invoice.amountMinor!==4900||invoice.currency!=='USD'||
     invoice.planAmountMinor!==4900||invoice.planCurrency!=='USD'||
     invoice.billingInterval!=='monthly'||
     !['active','trialing','past_due'].includes(invoice.subscriptionStatus)||
     invoice.cancelAtPeriodEnd===true)
     refuse('tenant_invoice_or_price_mismatch');

   // Even a server-side repeat is NOT allowed to contact Paddle again.
   const existing=rows(await tx.execute(sql`
     SELECT id FROM billing_paddle_checkout_attempts
     WHERE invoice_id=${input.invoiceId} OR id=${input.attemptId}
     LIMIT 1`));
   if(existing.length) refuse('attempt_already_reserved_reconcile_only');

   const inserted=rows(await tx.execute(sql`
     INSERT INTO billing_paddle_checkout_attempts
       (id,tenant_id,invoice_id,subscription_id,plan_id,paddle_price_id,
        environment,amount_minor,currency,expires_at)
     VALUES(${input.attemptId},${tenant},${input.invoiceId},
       ${input.subscriptionId},${input.planId},${PRICE},'sandbox',4900,
       'USD',${new Date(input.expiresAt).toISOString()}::timestamptz)
     RETURNING id`))[0];
   if(inserted?.id!==input.attemptId) refuse('reservation_not_committed');
   return {reserved:true as const,attemptId:input.attemptId,
     mayCreateRemoteTransaction:false as const,
     checkoutAllowed:false as const,entitlementGranted:false as const};
 });
}
