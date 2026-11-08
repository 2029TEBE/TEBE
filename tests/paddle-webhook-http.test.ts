/** End-to-end CI-only HTTP receipt/adjustment tests against disposable PostgreSQL. */
import { createHmac, randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { API, psql } from './helpers';
import { assertDisposableAcceptanceConfig } from '../scripts/phase15c-acceptance-safety.mjs';

const enabled=process.env.PADDLE_HTTP_CI_ACCEPTANCE==='true';
const key='pdl_synthetic_webhook_ci_secret_not_a_real_destination_secret';
const price='pri_'+'a'.repeat(26), transaction='txn_'+'b'.repeat(26);
const event1='evt_'+'c'.repeat(26), event2='evt_'+'d'.repeat(26), event3='evt_'+'e'.repeat(26);
const adjustmentId='adj_'+'f'.repeat(26);
const suffix=randomUUID().replace(/-/g,'').slice(0,16);
const slug='paddle-ci-http-'+suffix;
let tenant='',intent='',attempt='',invoice='',subscription='',plan='';

const completed=(extra: Record<string,unknown>={})=>({
 event_id:event1,event_type:'transaction.completed',
 data:{id:transaction,status:'completed',
  subscription_id:'sub_'+'a'.repeat(26),
  currency_code:'SAR',
  custom_data:{epmo_intent_id:intent,epmo_attempt_id:attempt,
   epmo_invoice_id:invoice,epmo_tenant_id:tenant,tenantId:tenant},
  details:{line_items:[{price_id:price,quantity:1}],
   totals:{grand_total:'11500'}},...extra}
});
const adjustment=(evt=event2,action='refund',status='pending_approval')=>({
 event_id:evt,event_type:'adjustment.created',
 data:{id:adjustmentId,transaction_id:transaction,action,status,
  currency_code:'SAR'}
});
function signed(event:unknown){
 const body=JSON.stringify(event), ts=Math.floor(Date.now()/1000);
 const signature=createHmac('sha256',key).update(ts+':'+body).digest('hex');
 return {body,header:'ts='+ts+';h1='+signature};
}
async function send(event:unknown,override?:Record<string,string>){
 const {body,header}=signed(event);
 const r=await fetch(API+'/api/v1/billing/paddle-webhook',{method:'POST',
  headers:{'content-type':'application/json','paddle-signature':header,...override},
  body});
 return {status:r.status,body:await r.json().catch(()=>null)};
}
function counts(){
 return psql(`SELECT
  (SELECT COUNT(*) FROM billing_paddle_webhook_receipts WHERE tenant_id='${tenant}'::uuid)
  ||'|'||(SELECT COUNT(*) FROM billing_paddle_settlements WHERE tenant_id='${tenant}'::uuid)
  ||'|'||(SELECT COUNT(*) FROM billing_paddle_adjustment_receipts WHERE tenant_id='${tenant}'::uuid)
  ||'|'||(SELECT status FROM billing_invoices WHERE id='${invoice}'::uuid)
  ||'|'||(SELECT status FROM tenant_subscriptions WHERE id='${subscription}'::uuid)`);
}
beforeAll(()=>{
 if(!enabled)return;
 assertDisposableAcceptanceConfig(process.env);
 const out=psql(`
  WITH t AS(INSERT INTO tenants(name,slug) VALUES('Paddle CI Webhook','${slug}') RETURNING id),
  p AS(INSERT INTO subscription_plans(code,name,price_minor,currency,billing_interval)
       VALUES('paddle_http_${suffix}','Paddle HTTP CI plan',11500,'SAR','monthly') RETURNING id),
  s AS(INSERT INTO tenant_subscriptions(tenant_id,plan_id,status,period_starts_at,period_ends_at)
       SELECT t.id,p.id,'trialing',now(),now()+interval '30 days' FROM t,p
       RETURNING id,tenant_id,plan_id),
  i AS(INSERT INTO billing_invoices(tenant_id,subscription_id,period_starts_at,period_ends_at,amount_minor,currency)
        SELECT tenant_id,id,now()+interval '30 days',now()+interval '60 days',11500,'SAR' FROM s
        RETURNING id,tenant_id),
  a AS(INSERT INTO billing_paddle_checkout_attempts
       (tenant_id,subscription_id,plan_id,invoice_id,paddle_price_id,
        environment,amount_minor,currency,expires_at)
       SELECT s.tenant_id,s.id,s.plan_id,i.id,
         '${price}','sandbox',11500,'SAR',now()+interval '15 minutes'
       FROM s JOIN i ON s.tenant_id=i.tenant_id
       RETURNING id,tenant_id,subscription_id,plan_id,invoice_id),
  c AS(INSERT INTO billing_paddle_checkout_intents
       (tenant_id,subscription_id,plan_id,invoice_id,attempt_id,paddle_transaction_id,paddle_price_id,environment,expires_at)
       SELECT a.tenant_id,a.subscription_id,a.plan_id,a.invoice_id,a.id,
         '${transaction}','${price}','sandbox',now()+interval '15 minutes'
       FROM a RETURNING id,attempt_id)
  SELECT t.id||'|'||c.id||'|'||c.attempt_id||'|'||i.id||'|'||s.id||'|'||p.id FROM t,p,s,i,c`);
 [tenant,intent,attempt,invoice,subscription,plan]=out.split('|');
 expect(tenant).toMatch(/^[0-9a-f-]{36}$/i);
});
afterAll(()=>{
 if(!enabled || !tenant)return;
 // Only this run's synthetic fixture. No user or production data.
 psql(`
  DELETE FROM billing_paddle_adjustment_receipts WHERE tenant_id='${tenant}'::uuid;
  DELETE FROM billing_paddle_settlements WHERE tenant_id='${tenant}'::uuid;
  DELETE FROM billing_paddle_webhook_receipts WHERE tenant_id='${tenant}'::uuid;
  DELETE FROM billing_paddle_checkout_intents WHERE tenant_id='${tenant}'::uuid;
  DELETE FROM billing_paddle_checkout_attempts WHERE tenant_id='${tenant}'::uuid;
  DELETE FROM billing_invoices WHERE tenant_id='${tenant}'::uuid;
  DELETE FROM tenant_subscriptions WHERE tenant_id='${tenant}'::uuid;
  DELETE FROM tenants WHERE id='${tenant}'::uuid AND slug='${slug}';
  DELETE FROM subscription_plans WHERE id='${plan}'::uuid AND code='paddle_http_${suffix}';`);
});
describe.skipIf(!enabled)('Paddle CI HTTP signed webhook gateway',()=>{
 it('rejects unsigned and cross-site browser submissions',async()=>{
  const r=await fetch(API+'/api/v1/billing/paddle-webhook',{
    method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  expect([400,401,403]).toContain(r.status);
  const rejected=await send(completed(),{'origin':'https://evil.example','sec-fetch-site':'cross-site'});
  expect(rejected.status).toBe(403);
  expect(counts()).toBe('0|0|0|open|trialing');
 });
 it('denies signed forged totals or mismatched provider tenant',async()=>{
  const wrong=completed({currency_code:'USD'});
  const r=await send(wrong);
  expect(r.status).toBeGreaterThanOrEqual(400);
  const forged=completed({custom_data:{epmo_intent_id:intent,tenantId:randomUUID()}});
  expect((await send(forged)).status).toBeGreaterThanOrEqual(400);
  expect(counts()).toBe('0|0|0|open|trialing');
 });
 it('refuses missing or foreign signed attempt, invoice and workspace identifiers',async()=>{
  for(const field of ['epmo_attempt_id','epmo_invoice_id','epmo_tenant_id'] as const){
    const missing={...completed().data.custom_data};
    delete (missing as Record<string,unknown>)[field];
    const noField=completed({custom_data:missing});
    expect((await send(noField)).status).toBeGreaterThanOrEqual(400);
    const changed={...completed().data.custom_data,[field]:randomUUID()};
    expect((await send(completed({custom_data:changed}))).status).toBeGreaterThanOrEqual(400);
  }
  expect(counts()).toBe('0|0|0|open|trialing');
 });
 it('persists signed transaction once but never marks invoice paid or grants access',async()=>{
  const r=await send(completed(),{'x-tenant-id':randomUUID()});
  expect(r.status).toBe(200);
  expect(r.body?.received).toBe(true);
  expect(r.body?.duplicate).toBe(false);
  expect(counts()).toBe('1|1|0|open|trialing');
 });
 it('returns durable duplicate acknowledgement without another payment',async()=>{
  const r=await send(completed());
  expect(r.status).toBe(200);
  expect(r.body?.duplicate).toBe(true);
  expect(counts()).toBe('1|1|0|open|trialing');
 });
 it('refuses changed signed replay and second event for same transaction',async()=>{
  const changed=completed({extra_test_marker:'not_the_original_payload'});
  const changedResponse=await send(changed);
  expect(changedResponse.status).toBeGreaterThanOrEqual(400);
  const second=completed();
  second.event_id='evt_'+'f'.repeat(26);
  expect((await send(second)).status).toBeGreaterThanOrEqual(400);
  expect(counts()).toBe('1|1|0|open|trialing');
 });
 it('records signed refund and chargeback notices for manual review only',async()=>{
  const first=await send(adjustment());
  expect(first.status).toBe(200);
  expect(counts()).toBe('1|1|1|open|trialing');
  const again=await send(adjustment());
  expect(again.status).toBe(200);
  expect(again.body?.duplicate).toBe(true);
  const dispute=await send(adjustment(event3,'chargeback','approved'));
  expect(dispute.status).toBe(200);
  expect(counts()).toBe('1|1|2|open|trialing');
 });
 it('rejects mismatched adjusted currency and unsupported notification without writes',async()=>{
  const wrong=adjustment('evt_'+'f'.repeat(26));
  wrong.data.currency_code='USD';
  expect((await send(wrong)).status).toBeGreaterThanOrEqual(400);
  expect((await send({event_id:event2,event_type:'customer.created',data:{id:'ctm_abc'}})).status).toBeGreaterThanOrEqual(400);
  expect(counts()).toBe('1|1|2|open|trialing');
 });
});
