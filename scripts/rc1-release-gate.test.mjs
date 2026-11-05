import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSimpleEnvFile, validateRc1Configuration, checkRepository, validateRc1Repository } from './rc1-release-gate.mjs';
const good={DEPLOYMENT_ENV:'staging',WEB_ORIGIN:'https://staging.theepmo.com',
PUBLIC_API_URL:'https://api-staging.theepmo.com',BILLING_PROVIDER:'paddle',PADDLE_ENABLED:'false',
PADDLE_ENV:'sandbox',PADDLE_WEBHOOK_PUBLIC_URL:'https://api-staging.theepmo.com/api/v1/billing/paddle-webhook',
BILLING_REFERENCE_WEBHOOK_ENABLED:'false',PG_USER:'pmo_admin',PG_PASSWORD:'strong-admin-password_123',
PG_DB:'pmo',DATABASE_URL:'postgres://pmo_app:strong-app-password_123@postgres:5432/pmo',
REDIS_PASSWORD:'strong-redis-password_123',REDIS_URL:'redis://:strong-redis-password_123@redis:6379'};
const failures=(e,mode='staging')=>validateRc1Configuration(e,mode).filter(x=>!x.passed).map(x=>x.name);
test('valid staging Paddle config is disabled',()=>assert.deepEqual(failures(good),[]));
test('production requires matching mode and origin',()=>{
 const e={...good,DEPLOYMENT_ENV:'production',WEB_ORIGIN:'https://app.theepmo.com',
 PUBLIC_API_URL:'https://api.theepmo.com',PADDLE_ENV:'production',
 PADDLE_WEBHOOK_PUBLIC_URL:'https://api.theepmo.com/api/v1/billing/paddle-webhook'};
 assert.deepEqual(failures(e,'production'),[]);
 assert.ok(failures({...e,PADDLE_ENV:'sandbox'},'production').length);
});
test('premature payments and provider changes blocked',()=>{
 assert.ok(failures({...good,PADDLE_ENABLED:'true'}).length);
 assert.ok(failures({...good,BILLING_PROVIDER:'none'}).length);
});
test('wrong webhook origin and path blocked',()=>{
 for(const url of ['https://attacker.test/api/v1/billing/paddle-webhook',
 'http://api-staging.theepmo.com/api/v1/billing/paddle-webhook',
 'https://api-staging.theepmo.com/api/v1/billing/other'])
 assert.ok(failures({...good,PADDLE_WEBHOOK_PUBLIC_URL:url}).length);
});
test('least-privileged DB, Redis, network, reference adapter',()=>{
 assert.ok(failures({...good,DATABASE_URL:'postgres://pmo_admin:strong-app-password_123@postgres:5432/pmo'}).length);
 assert.ok(failures({...good,REDIS_PASSWORD:'changed-password_123'}).length);
 assert.ok(failures({...good,WEB_BIND:'0.0.0.0'}).length);
 assert.ok(failures({...good,BILLING_REFERENCE_WEBHOOK_ENABLED:'true'}).length);
});
test('env parser refuses duplicate keys and shell interpolation',()=>{
 assert.deepEqual(parseSimpleEnvFile("KEY=ok # note\nQUOTED='has spaces'\n"),{KEY:'ok',QUOTED:'has spaces'});
 assert.throws(()=>parseSimpleEnvFile('A=1\nA=2'));
 assert.throws(()=>parseSimpleEnvFile('A=$'+'{B}'));
});
test('repo release checks pass for a disabled Paddle integration',()=>assert.deepEqual(checkRepository().filter(x=>!x.passed),[]));
test('missing provider settings fail',()=>assert.ok(validateRc1Repository({
 compose:'\n  api:\n    environment:\n  web:\n    environment:\nvolumes:',
 apiEnv:'',paddleSignature:'',ci:''}).filter(x=>!x.passed).length));
