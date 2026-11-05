import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canOfferSignup, issueSignupToken, hashSignupToken,
  signupConfirmationLink,signupMessage} from '../apps/api/src/auth/signup-policy.ts';

const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('public signup is explicitly disabled by default and production never qualifies',()=>{
  assert.equal(canOfferSignup({}),false);
  assert.equal(canOfferSignup({SIGNUP_ENABLED:'true',NODE_ENV:'production',DEPLOYMENT_ENV:'production'}),false);
  assert.equal(canOfferSignup({SIGNUP_ENABLED:'true',NODE_ENV:'production'}),false);
  assert.equal(canOfferSignup({SIGNUP_ENABLED:'true',NODE_ENV:'production',DEPLOYMENT_ENV:'staging'}),true);
  assert.equal(canOfferSignup({SIGNUP_ENABLED:'true',NODE_ENV:'test',CI:'true',GITHUB_ACTIONS:'true'}),false);
  assert.equal(canOfferSignup({SIGNUP_ENABLED:'true',NODE_ENV:'test',CI:'true',
    GITHUB_ACTIONS:'true',PHASE15_ACCEPT_DISPOSABLE_DB:'YES_RESEED_DISPOSABLE_TEST_DATABASE'}),true);
});
test('verification token is random high entropy, hashed and never embedded in HTTP pathname or query',()=>{
  const a=issueSignupToken(),b=issueSignupToken();
  assert.notEqual(a.token,b.token);
  assert.match(a.token,/^[A-Za-z0-9_-]{43}$/);
  assert.match(a.hash,/^[a-f0-9]{64}$/);
  assert.equal(hashSignupToken(a.token),a.hash);
  const link=new URL(signupConfirmationLink('https://staging.theepmo.com',a.token));
  assert.equal(link.origin,'https://staging.theepmo.com');
  assert.equal(link.pathname,'/signup/confirm');
  assert.equal(link.search,'');
  assert.equal(link.hash,'#token='+a.token);
  assert.doesNotMatch(link.origin+link.pathname+link.search,new RegExp(a.token));
});
test('signup verification links reject untrusted URL origins and token formats',()=>{
  const token=issueSignupToken().token;
  for(const origin of ['http://example.com','https://evil.example/path',
    'https://user:pass@staging.theepmo.com','javascript:alert(1)',
    'https://staging.theepmo.com/?a=b']){
    assert.throws(()=>signupConfirmationLink(origin,token));
  }
  assert.throws(()=>hashSignupToken('short'));
});
test('English and Arabic confirmation emails include a short, single-use verification deadline',()=>{
  const link=signupConfirmationLink('https://staging.theepmo.com',issueSignupToken().token);
  assert.match(signupMessage(link,'en').body,/30 minutes/);
  assert.match(signupMessage(link,'ar').body,/30 دقيقة/);
  assert.ok(signupMessage(link,'en').body.includes(link));
  assert.ok(signupMessage(link,'ar').body.includes(link));
});
test('SQL signup is a private 30-minute token and transactionally provisions one owner',()=>{
 const sql=src('packages/db/migrations/0027_email_verified_signup.sql');
 const role=src('packages/db/sql/rls.sql');
 assert.match(sql,/CREATE TABLE public.signup_requests/);
 assert.match(sql,/expires_at>now\(\)-interval '30 minutes'|now\(\)\+interval '30 minutes'/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/pmo_complete_signup_request/);
 assert.match(sql,/SELECT \* INTO requested/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/INSERT INTO public.tenants/);
 assert.match(sql,/INSERT INTO public.memberships/);
 assert.match(sql,/consumed_at=now\(\)/);
 assert.match(sql,/SECURITY DEFINER SET search_path = pg_catalog, public/);
 assert.match(sql,/REVOKE ALL ON public.signup_requests FROM pmo_app/);
 assert.match(role,/REVOKE ALL ON public.signup_requests FROM pmo_app/);
 assert.doesNotMatch(sql,/INSERT INTO (?:public\.)?(?:billing_invoices|billing_payments|tenant_subscriptions)/i);
});
test('registration web routes validate origin, never trust client tenant or grant payment',()=>{
 for(const route of ['apps/web/src/app/api/signup/request/route.ts',
    'apps/web/src/app/api/signup/confirm/route.ts']){
   const body=src(route);
   assert.match(body,/rejectUnsafeBrowserMutation\(req\)/);
   assert.doesNotMatch(body,/req\.headers\.get\('x-tenant-id'\)|paddle|stripe|\bcharge\s*\(|billing_payments/i);
 }
 const api=src('apps/api/src/auth/signup.service.ts');
 assert.match(api,/buildTransport/);
 assert.match(api,/pmo_revoke_signup_request/);
 assert.doesNotMatch(api,/db\.insert\(tenants\)|db\.insert\(users\)/);
});
