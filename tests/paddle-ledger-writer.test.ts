/**
 * CI-only LIVE PostgreSQL settlement acceptance. Never run on customer data.
 * No HTTP handler or real Paddle connection is involved.
 */
import { randomUUID, createHmac } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { psql } from './helpers';
import { assertDisposableAcceptanceConfig } from '../scripts/phase15c-acceptance-safety.mjs';
import {
  recordVerifiedPaddleSandboxSettlement, ensureDisposableWriter, verifyRawPaddleSignature,
} from '../apps/api/src/platform/paddle-ledger-writer';

const enabled=process.env.PADDLE_LEDGER_WRITE_MODE==='ci_disposable_only';
const price='pri_'+'a'.repeat(26);
const transaction='txn_'+'b'.repeat(26);
const firstEvent='evt_'+'c'.repeat(26);
const secondEvent='evt_'+'d'.repeat(26);
const secret='pdl_ci_dummy_webhook_endpoint_secret_not_for_any_real_destination';
let tenantId='',intentId='',attemptId='',invoiceId='',subscriptionId='',planId='',foreignTenant='';
const suffix=randomUUID().replace(/-/g,'').slice(0,18);
const slug='paddle-ci-writer-'+suffix;

function event(eventId=firstEvent,extra:Record<string,unknown>={}) {
  return {event_id:eventId,event_type:'transaction.completed',
    data:{id:transaction,status:'completed',subscription_id:'sub_'+'e'.repeat(26),
      currency_code:'SAR',custom_data:{epmo_intent_id:intentId,epmo_attempt_id:attemptId,
        epmo_invoice_id:invoiceId,epmo_tenant_id:tenantId,tenantId,...extra},
      details:{line_items:[{price_id:price,quantity:1}],
        totals:{grand_total:'11500'}}}};
}
function signed(obj:unknown,tenant=tenantId) {
  const rawBody=Buffer.from(JSON.stringify(obj));
  const nowSeconds=Math.floor(Date.now()/1000);
  const paddleSignature='ts='+nowSeconds+';h1='+
    createHmac('sha256',secret).update(String(nowSeconds)+':').update(rawBody).digest('hex');
  return {tenantId:tenant,rawBody,paddleSignature,endpointSecret:secret,nowSeconds};
}
function state(){
  return psql(`SELECT
  (SELECT count(*) FROM billing_paddle_webhook_receipts WHERE tenant_id='${tenantId}'::uuid)::text
  ||'|'||
  (SELECT count(*) FROM billing_paddle_settlements WHERE tenant_id='${tenantId}'::uuid)::text
  ||'|'||
  (SELECT status FROM billing_invoices WHERE id='${invoiceId}'::uuid)`);
}

beforeAll(()=>{
  if(!enabled)return;
  assertDisposableAcceptanceConfig(process.env);
  ensureDisposableWriter(process.env);
  const ids=psql(`
    WITH t AS (
      INSERT INTO tenants(name,slug) VALUES('Paddle isolated writer CI','${slug}') RETURNING id
    ), p AS (
      INSERT INTO subscription_plans(code,name,price_minor,currency,billing_interval)
      VALUES('paddle_ci_${suffix}','Paddle CI placeholder',11500,'SAR','monthly') RETURNING id
    ), s AS (
      INSERT INTO tenant_subscriptions(tenant_id,plan_id,status,period_starts_at,period_ends_at)
      SELECT t.id,p.id,'trialing',now(),now()+interval '30 days' FROM t,p
      RETURNING id,tenant_id,plan_id
    ), inv AS (
      INSERT INTO billing_invoices(tenant_id,subscription_id,period_starts_at,period_ends_at,amount_minor,currency)
      SELECT tenant_id,id,now()+interval '30 days',now()+interval '60 days',11500,'SAR'
      FROM s RETURNING id,tenant_id,subscription_id
    ), attempt AS (
      INSERT INTO billing_paddle_checkout_attempts
        (tenant_id,subscription_id,plan_id,invoice_id,
         paddle_price_id,environment,amount_minor,currency,expires_at)
      SELECT s.tenant_id,s.id,s.plan_id,inv.id,
        '${price}','sandbox',11500,'SAR',now()+interval '15 minutes'
      FROM s JOIN inv ON inv.tenant_id=s.tenant_id
      RETURNING id,tenant_id,subscription_id,plan_id,invoice_id
    ), checkout AS (
      INSERT INTO billing_paddle_checkout_intents
        (tenant_id,subscription_id,plan_id,invoice_id,attempt_id,
         paddle_transaction_id,paddle_price_id,environment,expires_at)
      SELECT a.tenant_id,a.subscription_id,a.plan_id,a.invoice_id,a.id,
        '${transaction}','${price}','sandbox',now()+interval '15 minutes'
      FROM attempt a
      RETURNING id,attempt_id
    )
    SELECT t.id||'|'||checkout.id||'|'||checkout.attempt_id||'|'||inv.id||'|'||s.id||'|'||p.id
    FROM t,p,s,inv,checkout`);
  [tenantId,intentId,attemptId,invoiceId,subscriptionId,planId]=ids.split('|');
  expect(tenantId).toMatch(/^[a-f0-9-]{36}$/i);
  expect(intentId).toMatch(/^[a-f0-9-]{36}$/i);
  foreignTenant=psql("SELECT id FROM tenants WHERE slug='nexa' LIMIT 1");
  expect(foreignTenant).toMatch(/^[a-f0-9-]{36}$/i);
});
afterAll(()=>{
  if(!enabled || !tenantId)return;
  // Administrative cleanup of ONLY our random disposable fixture.
  psql(`
    DELETE FROM billing_paddle_settlements WHERE tenant_id='${tenantId}'::uuid;
    DELETE FROM billing_paddle_webhook_receipts WHERE tenant_id='${tenantId}'::uuid;
    DELETE FROM billing_paddle_checkout_intents WHERE tenant_id='${tenantId}'::uuid;
    DELETE FROM billing_paddle_checkout_attempts WHERE tenant_id='${tenantId}'::uuid;
    DELETE FROM billing_invoices WHERE tenant_id='${tenantId}'::uuid;
    DELETE FROM tenant_subscriptions WHERE tenant_id='${tenantId}'::uuid;
    DELETE FROM tenants WHERE id='${tenantId}'::uuid AND slug='${slug}';
    DELETE FROM subscription_plans WHERE id='${planId}'::uuid AND code='paddle_ci_${suffix}';
  `);
});

describe.skipIf(!enabled)('Paddle P0 atomic CI-only settlement writer',()=>{
  it('refuses forged signatures and invalid totals without any ledger writes',async()=>{
    const unsig=signed(event());
    unsig.paddleSignature='ts=1700000000;h1='+'a'.repeat(64);
    await expect(recordVerifiedPaddleSandboxSettlement(unsig)).rejects.toThrow(/invalid_paddle_signature/);
    const wrong=event();wrong.data.details.totals.grand_total='11499';
    await expect(recordVerifiedPaddleSandboxSettlement(signed(wrong))).rejects.toThrow(/untrusted_invoice_intent/);
    expect(state()).toBe('0|0|open');
  });
  it('rejects signed cross-tenant and foreign-intent attempts',async()=>{
    await expect(recordVerifiedPaddleSandboxSettlement(signed(event(),foreignTenant)))
      .rejects.toThrow(/untrusted_invoice_intent/);
    const wrong=event();wrong.data.custom_data.epmo_intent_id=randomUUID();
    await expect(recordVerifiedPaddleSandboxSettlement(signed(wrong)))
      .rejects.toThrow(/untrusted_invoice_intent/);
    expect(state()).toBe('0|0|open');
  });
  it('inserts one receipt and settlement atomically but never grants entitlements',async()=>{
    const applied=await recordVerifiedPaddleSandboxSettlement(signed(event()));
    expect(applied.recorded).toBe(true);
    expect(applied.duplicate).toBe(false);
    expect(applied.entitlementGranted).toBe(false);
    expect(applied.invoiceMarkedPaid).toBe(false);
    expect(state()).toBe('1|1|open');
    const status=psql(`SELECT status FROM tenant_subscriptions WHERE id='${subscriptionId}'::uuid`);
    expect(status).toBe('trialing');
  });
  it('accepts exact signed replay idempotently without a duplicate insert',async()=>{
    const duplicate=await recordVerifiedPaddleSandboxSettlement(signed(event()));
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.recorded).toBe(false);
    expect(state()).toBe('1|1|open');
  });
  it('rejects conflicting content using a previously settled event ID',async()=>{
    const altered=event(firstEvent,{extra_metadata:'changed'});
    await expect(recordVerifiedPaddleSandboxSettlement(signed(altered)))
      .rejects.toThrow(/replayed_or_incomplete_receipt/);
    expect(state()).toBe('1|1|open');
  });
  it('refuses second event claiming same invoice and transaction',async()=>{
    await expect(recordVerifiedPaddleSandboxSettlement(signed(event(secondEvent))))
      .rejects.toThrow(/invoice_or_transaction_already_settled/);
    expect(state()).toBe('1|1|open');
  });
});
describe('Paddle raw-body HMAC signature validation (backend only)',()=>{
  const raw=Buffer.from('{"event_id":"evt_test","amount":"4900"}','utf8');
  const ts=1700000000;
  const h1=createHmac('sha256',secret).update(String(ts)+':').update(raw).digest('hex');
  it('accepts only exact signed bytes with a bounded timestamp',()=>{
    expect(verifyRawPaddleSignature(raw,'ts='+ts+';h1='+h1,secret,ts)).toBe(true);
    expect(verifyRawPaddleSignature(raw,'ts='+ts+';h1='+h1,secret,ts+5)).toBe(true);
    expect(verifyRawPaddleSignature(raw,'ts='+ts+';h1='+h1,secret,ts+6)).toBe(false);
    expect(verifyRawPaddleSignature(Buffer.from(raw.toString().replace('4900','4901')),
      'ts='+ts+';h1='+h1,secret,ts)).toBe(false);
  });
  it('rejects duplicate timestamps, forged MAC and unexpected header fields',()=>{
    expect(verifyRawPaddleSignature(raw,'ts='+ts+';ts='+ts+';h1='+h1,secret,ts)).toBe(false);
    expect(verifyRawPaddleSignature(raw,'ts='+ts+';h1='+h1+';extra=1',secret,ts)).toBe(false);
    expect(verifyRawPaddleSignature(raw,'ts='+ts+';h1='+'0'.repeat(64),secret,ts)).toBe(false);
    expect(verifyRawPaddleSignature(raw,'ts='+ts+';h1=nothex',secret,ts)).toBe(false);
  });
  it('rejects oversized body and untrusted endpoint secret',()=>{
    expect(verifyRawPaddleSignature(Buffer.alloc(65537), 'ts='+ts+';h1='+h1,secret,ts)).toBe(false);
    expect(verifyRawPaddleSignature(raw,'ts='+ts+';h1='+h1,'too-short',ts)).toBe(false);
  });
});

describe('Paddle CI gate must be impossible to enable accidentally',()=>{
  it('blocks production, staging and unapproved database targets',()=>{
    expect(()=>ensureDisposableWriter({...process.env,CI:'false'})).toThrow(/writer_disabled/);
    expect(()=>ensureDisposableWriter({...process.env,NODE_ENV:'production'})).toThrow(/writer_disabled/);
    expect(()=>ensureDisposableWriter({...process.env,DATABASE_URL:'postgres://pmo_app:secret@db.example.com:5432/pmo',PADDLE_LEDGER_WRITE_MODE:'ci_disposable_only',CI:'true',GITHUB_ACTIONS:'true',NODE_ENV:'test',PHASE15_ACCEPT_DISPOSABLE_DB:'YES_RESEED_DISPOSABLE_TEST_DATABASE'})).toThrow(/not_disposable_postgres/);
  });
});
