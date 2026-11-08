/** Real disposable PostgreSQL acceptance for Paddle checkout intent binding.
 * No customer records, no Paddle calls, no checkout URLs, no entitlements.
 * CI-only switch and explicit disposable-database acknowledgement are required.
 */
import {randomUUID,createHmac} from 'node:crypto';
import {beforeAll,afterAll,describe,expect,it} from 'vitest';
import {psql} from './helpers';
import {assertDisposableAcceptanceConfig} from '../scripts/phase15c-acceptance-safety.mjs';
import {persistDisposablePaddleCheckout} from '../apps/api/src/platform/paddle-checkout-intent-writer';
import {ensureDisposableWriter,recordVerifiedPaddleSandboxSettlement} from '../apps/api/src/platform/paddle-ledger-writer';

const enabled=process.env.PADDLE_LEDGER_WRITE_MODE==='ci_disposable_only';
const suffix=randomUUID().replace(/-/g,'').slice(0,18);
const slug='paddle-checkout-ci-'+suffix;
const foreignSlug='paddle-checkout-foreign-ci-'+suffix;
const txn='txn_'+randomUUID().replace(/-/g,'').slice(0,26);
const price='pri_01m6x7w5zy16nktzjwg2ezas2d';
const product='pro_01m6x789k8kmvez6zk7cm17wdz';
let tenant='',foreignTenant='',plan='',subscription='',invoice='';
const intent=randomUUID();
const attempt=randomUUID();
const signedEventId='evt_'+randomUUID().replace(/-/g,'').slice(0,26);
const signingSecret='ci_dummy_only_paddle_notification_signature_secret_not_for_live_use';
const expiry=Date.now()+10*60*1000;
const input=()=>({
 source:'locked-tenant-record' as const,
 provider:'paddle' as const,environment:'sandbox' as const,
 tenantId:tenant,intentId:intent,attemptId:attempt,invoiceId:invoice,
 subscriptionId:subscription,planId:plan,expiresAt:expiry,
 transactionId:txn,verifiedPriceId:price,verifiedProductId:product,
 transportValidated:true as const,requiresAtomicTenantPersistence:true as const,
});
const count=()=>psql(`SELECT COUNT(*) FROM billing_paddle_checkout_intents WHERE tenant_id='${tenant}'::uuid`);

beforeAll(()=>{
 if(!enabled)return;
 assertDisposableAcceptanceConfig(process.env);
 ensureDisposableWriter(process.env);
 const ids=psql(`
  WITH t AS (
    INSERT INTO tenants(name,slug) VALUES('Paddle checkout CI','${slug}') RETURNING id
  ), f AS (
    INSERT INTO tenants(name,slug) VALUES('Foreign Paddle checkout CI','${foreignSlug}') RETURNING id
  ), p AS (
    INSERT INTO subscription_plans(code,name,price_minor,currency,billing_interval)
    VALUES('paddle_checkout_ci_${suffix}','Team Workspace CI',4900,'USD','monthly') RETURNING id
  ), s AS (
    INSERT INTO tenant_subscriptions(tenant_id,plan_id,status,period_starts_at,period_ends_at)
    SELECT t.id,p.id,'trialing',now(),now()+interval '30 days' FROM t,p
    RETURNING id,tenant_id
  ), inv AS (
    INSERT INTO billing_invoices(tenant_id,subscription_id,period_starts_at,period_ends_at,amount_minor,currency)
    SELECT tenant_id,id,now(),now()+interval '30 days',4900,'USD' FROM s
    RETURNING id
  )
  SELECT t.id||'|'||f.id||'|'||p.id||'|'||s.id||'|'||inv.id FROM t,f,p,s,inv`);
 [tenant,foreignTenant,plan,subscription,invoice]=ids.split('|');
 for(const x of [tenant,foreignTenant,plan,subscription,invoice])
   expect(x).toMatch(/^[a-f0-9-]{36}$/i);
 psql(`INSERT INTO billing_paddle_checkout_attempts
 (id,tenant_id,invoice_id,subscription_id,plan_id,paddle_price_id,environment,amount_minor,currency,expires_at)
 VALUES ('${attempt}'::uuid,'${tenant}'::uuid,'${invoice}'::uuid,
 '${subscription}'::uuid,'${plan}'::uuid,'${price}','sandbox',4900,'USD',
 '${new Date(expiry).toISOString()}'::timestamptz)`);
});

afterAll(()=>{
 if(!enabled||!tenant)return;
 psql(`
 DELETE FROM billing_paddle_settlements WHERE tenant_id='${tenant}'::uuid;
 DELETE FROM billing_paddle_webhook_receipts WHERE tenant_id='${tenant}'::uuid;
 DELETE FROM billing_paddle_checkout_intents WHERE tenant_id='${tenant}'::uuid;
 DELETE FROM billing_paddle_checkout_attempts WHERE tenant_id='${tenant}'::uuid;
 DELETE FROM billing_invoices WHERE tenant_id='${tenant}'::uuid;
 DELETE FROM tenant_subscriptions WHERE tenant_id='${tenant}'::uuid;
 DELETE FROM tenants WHERE id IN ('${tenant}'::uuid,'${foreignTenant}'::uuid)
   AND slug IN ('${slug}','${foreignSlug}');
 DELETE FROM subscription_plans WHERE id='${plan}'::uuid
   AND code='paddle_checkout_ci_${suffix}';`);
});

describe.skipIf(!enabled)('Paddle checkout intent writer, disposable PostgreSQL',()=>{
 it('refuses spoofed price, unknown transaction, foreign invoice and tenant',async()=>{
  await expect(persistDisposablePaddleCheckout({...input(),verifiedPriceId:'pri_'+'a'.repeat(26)}))
    .rejects.toThrow(/untrusted_provider_transaction_or_intent/);
  await expect(persistDisposablePaddleCheckout({...input(),transactionId:'invalid'}))
    .rejects.toThrow(/untrusted_provider_transaction_or_intent/);
  await expect(persistDisposablePaddleCheckout({...input(),tenantId:foreignTenant}))
    .rejects.toThrow(/untrusted_invoice_or_subscription_terms/);
  await expect(persistDisposablePaddleCheckout({...input(),invoiceId:randomUUID()}))
    .rejects.toThrow(/untrusted_invoice_or_subscription_terms/);
  await expect(persistDisposablePaddleCheckout({...input(),attemptId:randomUUID()}))
    .rejects.toThrow(/missing_or_mismatched_precreate_reservation/);
  expect(count()).toBe('0');
 });
 it('saves exactly one intent bound to the correct invoice, tenant and transaction',async()=>{
  const saved=await persistDisposablePaddleCheckout(input());
  expect(saved.persisted).toBe(true);
  expect(saved.checkoutAllowed).toBe(false);
  expect(saved.entitlementGranted).toBe(false);
  const record=psql(`SELECT tenant_id||'|'||invoice_id||'|'||
   subscription_id||'|'||plan_id||'|'||paddle_transaction_id||'|'||
   paddle_price_id||'|'||environment||'|'||attempt_id
   FROM billing_paddle_checkout_intents WHERE id='${intent}'::uuid`);
  expect(record).toBe([tenant,invoice,subscription,plan,txn,price,'sandbox',attempt].join('|'));
  expect(count()).toBe('1');
  expect(psql(`SELECT status FROM billing_invoices WHERE id='${invoice}'::uuid`)).toBe('open');
  expect(psql(`SELECT status FROM tenant_subscriptions WHERE id='${subscription}'::uuid`)).toBe('trialing');
 });
 it('refuses repeat binds without changing paid status or adding rows',async()=>{
  await expect(persistDisposablePaddleCheckout(input()))
    .rejects.toThrow(/existing_checkout_requires_reconciliation/);
  expect(count()).toBe('1');
  expect(psql(`SELECT COUNT(*) FROM billing_paddle_settlements WHERE tenant_id='${tenant}'::uuid`)).toBe('0');
 });
 it('rejects unsigned and mismatched signed settlement, then records the valid event without entitlements',async()=>{
  const event={
    event_id:signedEventId,event_type:'transaction.completed',
    data:{id:txn,status:'completed',collection_mode:'automatic',subscription_id:'sub_'+'b'.repeat(26),
      currency_code:'USD',custom_data:{epmo_intent_id:intent,tenantId:tenant,
        epmo_attempt_id:attempt,epmo_invoice_id:invoice,epmo_tenant_id:tenant},
      details:{line_items:[{price_id:price,quantity:1}],
        totals:{grand_total:'4900'}}}
  };
  const signed=(body:unknown,tenantId=tenant)=>{
    const rawBody=Buffer.from(JSON.stringify(body));
    const nowSeconds=Math.floor(Date.now()/1000);
    const paddleSignature='ts='+nowSeconds+';h1='+
      createHmac('sha256',signingSecret)
        .update(String(nowSeconds)+':').update(rawBody).digest('hex');
    return {tenantId,rawBody,paddleSignature,endpointSecret:signingSecret,nowSeconds};
  };
  const invalid=signed(event);
  invalid.paddleSignature='ts=1700000000;h1='+'a'.repeat(64);
  await expect(recordVerifiedPaddleSandboxSettlement(invalid))
    .rejects.toThrow(/invalid_paddle_signature/);
  // Signed notifications are still insufficient if the provider's final
  // customer total differs from the server-owned open invoice. This covers
  // tax-included surcharges, discounted totals and mismatched currency.
  for(const [grandTotal,currency] of [
    ['4901','USD'], // additional cent / tax difference
    ['5880','USD'], // tax-inclusive amount above the approved invoice
    ['4899','USD'], // discount or underpayment
    ['4900','SAR'], // different settlement currency
  ]){
    const wrong={...event,data:{...event.data,currency_code:currency,
      details:{...event.data.details,totals:{grand_total:grandTotal}}}};
    await expect(recordVerifiedPaddleSandboxSettlement(signed(wrong)))
      .rejects.toThrow(/untrusted_invoice_intent_or_provider_totals/);
  }
  // A signed notification claiming another workspace is not sufficient to
  // change the trusted database tenant binding.
  const foreign={...event,data:{...event.data,
    custom_data:{...event.data.custom_data,tenantId:foreignTenant}}};
  await expect(recordVerifiedPaddleSandboxSettlement(signed(foreign)))
    .rejects.toThrow(/provider_tenant_mismatch/);
  // Even correctly HMAC-signed provider metadata cannot override the
  // immutable pre-Paddle attempt journal for this exact tenant invoice.
  for(const [field,value] of [
    ['epmo_attempt_id',randomUUID()],
    ['epmo_invoice_id',randomUUID()],
    ['epmo_tenant_id',foreignTenant],
    ['epmo_attempt_id',undefined],
    ['epmo_invoice_id',undefined],
    ['epmo_tenant_id',undefined],
  ] as const) {
    const tampered={...event,data:{...event.data,
      custom_data:{...event.data.custom_data,[field]:value}}};
    await expect(recordVerifiedPaddleSandboxSettlement(signed(tampered)))
      .rejects.toThrow(/untrusted_precreate_attempt_or_webhook_binding/);
  }
  // A legacy checkout-intent that predates the required pre-provider attempt
  // must never be accepted into a settlement by a valid provider signature.
  // This is enforced by the writer guard and remains a release migration gate.
  // Keep the original test fixture's attempt untouched for subsequent success.
  await expect(recordVerifiedPaddleSandboxSettlement(signed(event,foreignTenant)))
    .rejects.toThrow(/untrusted_invoice_intent_or_provider_totals/);
  expect(psql(`SELECT COUNT(*) FROM billing_paddle_webhook_receipts WHERE tenant_id='${tenant}'::uuid`)).toBe('0');
  expect(psql(`SELECT COUNT(*) FROM billing_paddle_settlements WHERE tenant_id='${tenant}'::uuid`)).toBe('0');
  const result=await recordVerifiedPaddleSandboxSettlement(signed(event));
  expect(result.recorded).toBe(true);
  expect(result.invoiceMarkedPaid).toBe(false);
  expect(result.entitlementGranted).toBe(false);
  expect(psql(`SELECT COUNT(*) FROM billing_paddle_settlements WHERE tenant_id='${tenant}'::uuid`)).toBe('1');
  expect(psql(`SELECT status FROM billing_invoices WHERE id='${invoice}'::uuid`)).toBe('open');
  expect(psql(`SELECT status FROM tenant_subscriptions WHERE id='${subscription}'::uuid`)).toBe('trialing');
  const replay=await recordVerifiedPaddleSandboxSettlement(signed(event));
  expect(replay.duplicate).toBe(true);
  expect(replay.entitlementGranted).toBe(false);
  // Replay with same provider event ID but an altered (validly signed) body
  // cannot be accepted as the original immutable receipt.
  const changedBody={...event,data:{...event.data,extra_test_marker:'different_bytes'}};
  await expect(recordVerifiedPaddleSandboxSettlement(signed(changedBody)))
    .rejects.toThrow(/replayed_or_incomplete_receipt/);

  // A DIFFERENT valid event ID for the SAME Paddle transaction cannot settle
  // the same invoice twice even when its signature, amount and tenant match.
  const alternateEvent={...event,event_id:'evt_'+randomUUID().replace(/-/g,'').slice(0,26)};
  await expect(recordVerifiedPaddleSandboxSettlement(signed(alternateEvent)))
    .rejects.toThrow(/invoice_or_transaction_already_settled/);

  // Both attack classes must leave exactly the original receipt and settlement,
  // without marking the invoice paid or granting a subscription.
  expect(psql(`SELECT COUNT(*) FROM billing_paddle_webhook_receipts WHERE tenant_id='${tenant}'::uuid`)).toBe('1');
  expect(psql(`SELECT COUNT(*) FROM billing_paddle_settlements WHERE tenant_id='${tenant}'::uuid`)).toBe('1');
  expect(psql(`SELECT status FROM billing_invoices WHERE id='${invoice}'::uuid`)).toBe('open');
  expect(psql(`SELECT status FROM tenant_subscriptions WHERE id='${subscription}'::uuid`)).toBe('trialing');
 });

});
