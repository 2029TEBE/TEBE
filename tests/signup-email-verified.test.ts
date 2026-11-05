/** CI-only real PostgreSQL/email-token/HTTP signup proof. No outbound email. */
import { createHash, randomBytes } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { API, get, login, psql } from './helpers';
import { assertDisposableAcceptanceConfig } from '../scripts/phase15c-acceptance-safety.mjs';

const enabled=process.env.SIGNUP_LIVE_ACCEPTANCE==='true';
const suffix=randomBytes(8).toString('hex');
const email='signup-ci-'+suffix+'@example.invalid';
const token=randomBytes(32).toString('base64url');
const tokenHash=createHash('sha256').update(token).digest('hex');
const password='CI-Synthetic-Signup-Only-2026';
let tenant='',user='',session='';
const confirm=(t=token)=>fetch(API+'/auth/signup/confirm',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({token:t,password}),
});

beforeAll(()=>{
  if(!enabled)return;
  assertDisposableAcceptanceConfig({...process.env,PHASE15_BILLING_ACCEPTANCE:'true'});
  expect(process.env.CI).toBe('true');
  expect(process.env.GITHUB_ACTIONS).toBe('true');
  expect(process.env.SIGNUP_ENABLED).toBe('true');
  const issued=psql(`SELECT public.pmo_issue_signup_request(
   '${email}','Synthetic Registration Owner','Synthetic Evaluation Tenant',
   '${tokenHash}')`);
  expect(issued).toBe('t');
});
afterAll(()=>{
  if(!enabled)return;
  // Only the synthetically created account/tenant can be cleaned up here.
  if(tenant) {
    psql(`DELETE FROM tenant_evaluation_trials WHERE tenant_id='${tenant}'::uuid;
       DELETE FROM tenants WHERE id='${tenant}'::uuid;`);
  }
  psql(`DELETE FROM signup_requests WHERE email='${email}';
       DELETE FROM users WHERE email='${email}';`);
});

describe.skipIf(!enabled)('Email-verified registration -> tenant -> optional Evaluation',()=>{
  it('does not create user or workspace before verifying a mailbox token',()=>{
    expect(psql(`SELECT count(*) FROM users WHERE email='${email}'`)).toBe('0');
    expect(psql(`SELECT count(*) FROM signup_requests WHERE email='${email}'`)).toBe('1');
  });
  it('fails closed for malformed bearer and missing mail delivery',async()=>{
    expect((await confirm('invalid')).status).toBe(400);
    const request=await fetch(API+'/auth/signup/request',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({
        email:'other-'+suffix+'@example.invalid',
        displayName:'Fake Name',workspaceName:'Fake Workspace',lang:'en',
      }),
    });
    // No SES delivery in disposable CI; endpoint must not pretend it emailed.
    expect(request.status).toBe(503);
    expect(psql(`SELECT count(*) FROM users WHERE email='${email}'`)).toBe('0');
  });
  it('creates one user, owned empty tenant and audit on valid single-use proof',async()=>{
    const result=await confirm();
    expect(result.status).toBe(200);
    const body=await result.json();
    expect(body.verified).toBe(true);
    expect(body.charged).toBe(false);
    expect(body.trialStarted).toBe(false);
    expect(JSON.stringify(body)).not.toContain(token);
    const ids=psql(`
      SELECT u.id||'|'||t.id FROM users u
        JOIN memberships m ON m.user_id=u.id
        JOIN tenants t ON t.id=m.tenant_id
      WHERE u.email='${email}' AND m.role='owner'`);
    [user,tenant]=ids.split('|');
    expect(user).toMatch(/^[0-9a-f-]{36}$/i);
    expect(tenant).toMatch(/^[0-9a-f-]{36}$/i);
    const state=psql(`
      SELECT
        (SELECT count(*) FROM tenant_subscriptions WHERE tenant_id='${tenant}'::uuid)
        ||'|'||(SELECT count(*) FROM billing_invoices WHERE tenant_id='${tenant}'::uuid)
        ||'|'||(SELECT count(*) FROM portfolios WHERE tenant_id='${tenant}'::uuid)`);
    expect(state).toBe('0|0|0');
    expect(psql(`SELECT count(*) FROM auth_events
      WHERE user_id='${user}'::uuid AND action='signup.email_verified'`)).toBe('1');
  });
  it('replay and duplicate request cannot create another user or workspace',async()=>{
    expect((await confirm()).status).toBe(400);
    expect(psql(`SELECT public.pmo_issue_signup_request(
      '${email}','Other User','Other Workspace',
      '${createHash('sha256').update('unrelated').digest('hex')}')`)).toBe('f');
    expect(psql(`SELECT count(*) FROM users WHERE email='${email}'`)).toBe('1');
    expect(psql(`SELECT count(*) FROM tenants t JOIN memberships m ON m.tenant_id=t.id
      JOIN users u ON u.id=m.user_id WHERE u.email='${email}'`)).toBe('1');
  });
  it('new owner signs in and explicitly activates one free 7-day Evaluation',async()=>{
    const auth=await login(email,password);
    expect(auth.res.status).toBe(200);
    expect(auth.token).toBeTruthy();
    session=auth.token!;
    const current=await get('/api/v1/subscription/current',session);
    expect(current.status).toBe(200);
    expect(current.body).toBeNull();
    const activation=await fetch(API+'/api/v1/subscription/evaluation/start',{
      method:'POST',headers:{cookie:'pmo_session='+session,
        'content-type':'application/json'},body:'{}'
    });
    expect(activation.status).toBe(201);
    const body=await activation.json();
    expect(body.priceMinor).toBe(0);
    expect(body.requiresCard).toBe(false);
    expect(body.renewsAutomatically).toBe(false);
    expect(new Date(body.expiresAt).getTime()-new Date(body.startedAt).getTime())
      .toBe(168*3_600_000);
    const counts=psql(`
      SELECT
        (SELECT count(*) FROM tenant_evaluation_trials WHERE tenant_id='${tenant}'::uuid)
        ||'|'||(SELECT count(*) FROM billing_payments WHERE tenant_id='${tenant}'::uuid)
        ||'|'||(SELECT count(*) FROM projects WHERE tenant_id='${tenant}'::uuid)`);
    expect(counts).toBe('1|0|2');
    expect((await fetch(API+'/api/v1/subscription/evaluation/start',{
      method:'POST',headers:{cookie:'pmo_session='+session}
    })).status).toBe(409);
  });
});
