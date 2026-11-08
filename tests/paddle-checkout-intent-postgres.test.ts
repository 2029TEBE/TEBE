/** Real disposable PostgreSQL acceptance for Paddle checkout intent binding.
 * No customer records, no Paddle calls, no checkout URLs, no entitlements.
 * CI-only switch and explicit disposable-database acknowledgement are required.
 */
import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,describe,expect,it} from 'vitest';
import {psql} from './helpers';
import {assertDisposableAcceptanceConfig} from '../scripts/phase15c-acceptance-safety.mjs';
import {persistDisposablePaddleCheckout} from '../apps/api/src/platform/paddle-checkout-intent-writer';
import {ensureDisposableWriter} from '../apps/api/src/platform/paddle-ledger-writer';

const enabled=process.env.PADDLE_LEDGER_WRITE_MODE==='ci_disposable_only';
const suffix=randomUUID().replace(/-/g,'').slice(0,18);
const slug='paddle-checkout-ci-'+suffix;
const foreignSlug='paddle-checkout-foreign-ci-'+suffix;
const txn='txn_'+randomUUID().replace(/-/g,'').slice(0,26);
const price='pri_01m6x7w5zy16nktzjwg2ezas2d';
const product='pro_01m6x789k8kmvez6zk7cm17wdz';
let tenant='',foreignTenant='',plan='',subscription='',invoice='';
const intent=randomUUID();
const expiry=Date.now()+10*60*1000;
const input=()=>({
 source:'locked-tenant-record' as const,
 provider:'paddle' as const,environment:'sandbox' as const,
 tenantId:tenant,intentId:intent,invoiceId:invoice,
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
});

afterAll(()=>{
 if(!enabled||!tenant)return;
 psql(`
 DELETE FROM billing_paddle_checkout_intents WHERE tenant_id='${tenant}'::uuid;
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
  expect(count()).toBe('0');
 });
 it('saves exactly one intent bound to the correct invoice, tenant and transaction',async()=>{
  const saved=await persistDisposablePaddleCheckout(input());
  expect(saved.persisted).toBe(true);
  expect(saved.checkoutAllowed).toBe(false);
  expect(saved.entitlementGranted).toBe(false);
  const record=psql(`SELECT tenant_id||'|'||invoice_id||'|'||
   subscription_id||'|'||plan_id||'|'||paddle_transaction_id||'|'||
   paddle_price_id||'|'||environment
   FROM billing_paddle_checkout_intents WHERE id='${intent}'::uuid`);
  expect(record).toBe([tenant,invoice,subscription,plan,txn,price,'sandbox'].join('|'));
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
});
