import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,describe,expect,it} from 'vitest';
import {psql} from './helpers';
import {assertDisposableAcceptanceConfig} from '../scripts/phase15c-acceptance-safety.mjs';
import {ensureDisposableWriter} from '../apps/api/src/platform/paddle-ledger-writer';
import {reserveDisposablePaddleAttempt as reserve} from
 '../apps/api/src/platform/paddle-checkout-attempt-reservation';

const enabled=process.env.PADDLE_LEDGER_WRITE_MODE==='ci_disposable_only';
const suffix=randomUUID().replace(/-/g,'').slice(0,16);
const slug='paddle-reservation-'+suffix;
const foreignSlug='paddle-reservation-foreign-'+suffix;
const attemptId=randomUUID();
let tenant='',foreignTenant='',plan='',subscription='',invoice='';
const expiry=Date.now()+10*60*1000;
const input=()=>({
 source:'locked-tenant-record' as const,
 provider:'paddle' as const,environment:'sandbox' as const,
 tenantId:tenant,attemptId,invoiceId:invoice,subscriptionId:subscription,
 planId:plan,expiresAt:expiry,
 paddlePriceId:'pri_01m6x7w5zy16nktzjwg2ezas2d',
 amountMinor:4900 as const,currency:'USD' as const,
});
const count=()=>psql(`SELECT count(*) FROM billing_paddle_checkout_attempts WHERE tenant_id='${tenant}'::uuid`);
beforeAll(()=>{
 if(!enabled)return;
 assertDisposableAcceptanceConfig(process.env);
 ensureDisposableWriter(process.env);
 const ids=psql(`WITH t AS(
  INSERT INTO tenants(name,slug) VALUES('Paddle attempt CI','${slug}') RETURNING id
 ),f AS(
  INSERT INTO tenants(name,slug) VALUES('Foreign Paddle attempt CI','${foreignSlug}') RETURNING id
 ),p AS(
  INSERT INTO subscription_plans(code,name,price_minor,currency,billing_interval)
  VALUES('attempt_ci_${suffix}','Paddle 49 USD CI',4900,'USD','monthly') RETURNING id
 ),s AS(
  INSERT INTO tenant_subscriptions(tenant_id,plan_id,status,period_starts_at,period_ends_at)
  SELECT t.id,p.id,'trialing',now(),now()+interval '30 days' FROM t,p
  RETURNING id,tenant_id
 ),i AS(
  INSERT INTO billing_invoices(tenant_id,subscription_id,period_starts_at,period_ends_at,amount_minor,currency)
  SELECT tenant_id,id,now(),now()+interval '30 days',4900,'USD' FROM s RETURNING id
 )
 SELECT t.id||'|'||f.id||'|'||p.id||'|'||s.id||'|'||i.id FROM t,f,p,s,i`);
 [tenant,foreignTenant,plan,subscription,invoice]=ids.split('|');
 expect(tenant).toMatch(/^[a-f0-9-]{36}$/i);
});
afterAll(()=>{
 if(!enabled||!tenant)return;
 psql(`DELETE FROM billing_paddle_checkout_intents WHERE tenant_id='${tenant}'::uuid;
 DELETE FROM billing_paddle_checkout_attempts WHERE tenant_id='${tenant}'::uuid;
 DELETE FROM billing_invoices WHERE tenant_id='${tenant}'::uuid;
 DELETE FROM tenant_subscriptions WHERE tenant_id='${tenant}'::uuid;
 DELETE FROM tenants WHERE id IN ('${tenant}'::uuid,'${foreignTenant}'::uuid)
  AND slug IN ('${slug}','${foreignSlug}');
 DELETE FROM subscription_plans WHERE id='${plan}'::uuid AND code='attempt_ci_${suffix}';`);
});
describe.skipIf(!enabled)('Paddle durable precreate attempt reservation, isolated PostgreSQL',()=>{
 it('rejects forged price, wrong invoice and foreign tenant before writing',async()=>{
  await expect(reserve({...input(),amountMinor:1 as 4900}))
    .rejects.toThrow(/invalid_server_reservation/);
  await expect(reserve({...input(),paddlePriceId:'pri_'+'x'.repeat(26)}))
    .rejects.toThrow(/invalid_server_reservation/);
  await expect(reserve({...input(),tenantId:foreignTenant}))
    .rejects.toThrow(/tenant_invoice_or_price_mismatch/);
  await expect(reserve({...input(),invoiceId:randomUUID()}))
    .rejects.toThrow(/tenant_invoice_or_price_mismatch/);
  expect(count()).toBe('0');
 });
 it('commits one durable reservation without remote transaction or entitlement',async()=>{
  const r=await reserve(input());
  expect(r.reserved).toBe(true);
  expect(r.mayCreateRemoteTransaction).toBe(false);
  expect(r.checkoutAllowed).toBe(false);
  expect(r.entitlementGranted).toBe(false);
  const row=psql(`SELECT tenant_id||'|'||invoice_id||'|'||subscription_id||'|'||
    plan_id||'|'||paddle_price_id||'|'||amount_minor||'|'||currency||'|'||environment
    FROM billing_paddle_checkout_attempts WHERE id='${attemptId}'::uuid`);
  expect(row).toBe([tenant,invoice,subscription,plan,
    'pri_01m6x7w5zy16nktzjwg2ezas2d','4900','USD','sandbox'].join('|'));
  expect(psql(`SELECT status FROM billing_invoices WHERE id='${invoice}'::uuid`)).toBe('open');
 });
 it('blocks a second reservation on same invoice and leaves only one row',async()=>{
  await expect(reserve({...input(),attemptId:randomUUID()}))
    .rejects.toThrow(/attempt_already_reserved_reconcile_only/);
  expect(count()).toBe('1');
  expect(psql(`SELECT count(*) FROM billing_paddle_settlements WHERE tenant_id='${tenant}'::uuid`)).toBe('0');
 });
});
