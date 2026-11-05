import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,describe,expect,it} from 'vitest';
import {API,get,login,psql} from './helpers';
import {assertDisposableAcceptanceConfig} from '../scripts/phase15c-acceptance-safety.mjs';

const enabled=process.env.EVALUATION_LIVE_ACCEPTANCE==='true';
const suffix=randomUUID().replace(/-/g,'').slice(0,16);
const slug='evaluation-ci-'+suffix;
let tenant='',token='',subscription='';
const post=()=>fetch(API+'/api/v1/subscription/evaluation/start',{
  method:'POST',headers:{cookie:'pmo_session='+token,'content-type':'application/json'},body:'{}'
});

beforeAll(async()=>{
  if(!enabled)return;
  assertDisposableAcceptanceConfig({...process.env,PHASE15_BILLING_ACCEPTANCE:'true'});
  tenant=psql(`INSERT INTO tenants(name,slug)
     VALUES('Synthetic Evaluation ${suffix}','${slug}') RETURNING id`);
  const owner=psql("SELECT id FROM users WHERE email='fatima@al-nakheel.test' LIMIT 1");
  expect(tenant).toMatch(/^[a-f0-9-]{36}$/i);
  expect(owner).toMatch(/^[a-f0-9-]{36}$/i);
  psql(`INSERT INTO memberships(tenant_id,user_id,role)
         VALUES('${tenant}'::uuid,'${owner}'::uuid,'owner'::member_role)`);
  const auth=await login('fatima@al-nakheel.test');
  expect(auth.res.status).toBe(200);
  expect(auth.token).toBeTruthy();
  token=auth.token!;
  const switched=await fetch(API+'/auth/switch-tenant',{
    method:'POST',headers:{cookie:'pmo_session='+token,'content-type':'application/json'},
    body:JSON.stringify({tenantId:tenant})
  });
  expect(switched.status).toBe(200);
});
afterAll(()=>{
  if(!enabled || !tenant)return;
  // Delete only the randomly created disposable tenant; this is not a customer.
  psql(`
    DELETE FROM tenant_evaluation_trials WHERE tenant_id='${tenant}'::uuid;
    DELETE FROM subscription_events WHERE tenant_id='${tenant}'::uuid;
    DELETE FROM tenant_subscriptions WHERE tenant_id='${tenant}'::uuid;
    DELETE FROM tenants WHERE id='${tenant}'::uuid AND slug='${slug}';`);
});
describe.skipIf(!enabled)('7-day Evaluation authenticated API acceptance',()=>{
  it('begins with no subscription and refuses anonymous activation',async()=>{
    expect((await get('/api/v1/subscription/current',token)).body).toBeNull();
    const unauth=await fetch(API+'/api/v1/subscription/evaluation/start',{method:'POST'});
    expect(unauth.status).toBe(401);
  });
  it('grants exactly seven days and fictional RLS-scoped data without invoices',async()=>{
    const response=await post();
    expect(response.status).toBe(201);
    const body=await response.json();
    subscription=body.subscriptionId;
    expect(body.planCode).toBe('evaluation_7day');
    expect(body.status).toBe('trialing');
    expect(body.priceMinor).toBe(0);
    expect(body.requiresCard).toBe(false);
    expect(body.renewsAutomatically).toBe(false);
    expect(body.demoData).toBe('fictional');
    expect(new Date(body.expiresAt).getTime()-new Date(body.startedAt).getTime()).toBe(168*3_600_000);
    const result=psql(`
      SELECT
       (SELECT count(*) FROM tenant_evaluation_trials WHERE tenant_id='${tenant}'::uuid)
      ||'|'||(SELECT count(*) FROM tenant_subscriptions WHERE tenant_id='${tenant}'::uuid)
      ||'|'||(SELECT count(*) FROM billing_invoices WHERE tenant_id='${tenant}'::uuid)
      ||'|'||(SELECT count(*) FROM billing_payments WHERE tenant_id='${tenant}'::uuid)
      ||'|'||(SELECT count(*) FROM projects WHERE tenant_id='${tenant}'::uuid)`);
    expect(result).toBe('1|1|0|0|2');
    const projects=await get('/api/v1/projects?limit=100',token);
    expect(projects.status).toBe(200);
    expect(JSON.stringify(projects.body)).toContain('[DEMO]');
    expect(JSON.stringify(projects.body)).not.toContain('Nexa Core Platform');
  });
  it('does not restart the Evaluation on a duplicate request',async()=>{
    expect((await post()).status).toBe(409);
    expect(psql(`SELECT count(*) FROM tenant_evaluation_trials WHERE tenant_id='${tenant}'::uuid`)).toBe('1');
  });
  it('expires access to core and licensed routes but keeps billing recovery readable',async()=>{
    psql(`
      UPDATE tenant_evaluation_trials
      SET started_at=now()-interval '169 hours',expires_at=now()-interval '1 hour'
      WHERE tenant_id='${tenant}'::uuid;
      UPDATE tenant_subscriptions
      SET period_starts_at=now()-interval '169 hours',
          period_ends_at=now()-interval '1 hour',
          trial_ends_at=now()-interval '1 hour'
      WHERE tenant_id='${tenant}'::uuid AND id='${subscription}'::uuid;`);
    const current=await get('/api/v1/subscription/current',token);
    expect(current.status).toBe(200);
    expect(current.body.status).toBe('expired');
    expect((await get('/api/v1/projects?limit=100',token)).status).toBe(403);
    expect((await get('/api/v1/onboarding/status',token)).status).toBe(403);
    expect((await get('/api/v1/subscription/plans',token)).status).toBe(200);
    expect((await post()).status).toBe(403);
  });
});
