import test from 'node:test';
import assert from 'node:assert/strict';
import { EVALUATION_PLAN_CODE, EVALUATION_HOURS,
  effectiveEvaluationStatus, isEvaluationRecoveryRead
} from '../apps/api/src/platform/evaluation-policy.ts';

const start=Date.parse('2026-11-05T15:00:00Z');
const end=start+168*3_600_000;
const evalRow={
  planCode:EVALUATION_PLAN_CODE,status:'trialing',
  periodStartsAt:new Date(start).toISOString(),
  periodEndsAt:new Date(end).toISOString(),
  trialEndsAt:new Date(end).toISOString(),
};
test('Evaluation is free, exactly 168 hours, and expires without a cron task',()=>{
  assert.equal(EVALUATION_HOURS,168);
  assert.equal(effectiveEvaluationStatus(evalRow,start-1),'expired');
  assert.equal(effectiveEvaluationStatus(evalRow,start),'trialing');
  assert.equal(effectiveEvaluationStatus(evalRow,end-1),'trialing');
  assert.equal(effectiveEvaluationStatus(evalRow,end),'expired');
  assert.equal(effectiveEvaluationStatus(evalRow,end+24*3600_000),'expired');
});
test('tampered duration, missing trial timestamp, early cancel and malicious active flag fail closed',()=>{
  for(const changed of [
    {periodEndsAt:new Date(end+1).toISOString()},
    {trialEndsAt:null},
    {status:'active'},
    {status:'canceled'},
    {periodStartsAt:new Date(start+1).toISOString()},
  ]) assert.equal(effectiveEvaluationStatus({...evalRow,...changed},start+100),'expired');
});
test('paid plans are not affected by evaluation-only expiry rules',()=>{
  assert.equal(effectiveEvaluationStatus({...evalRow,planCode:'business',status:'active'},end+1),'active');
});
test('expired evaluation can read billing recovery but never perform any writes',()=>{
  for(const path of ['/api/v1/subscription/current','/api/v1/subscription/plans',
    '/api/v1/subscription/history','/api/v1/subscription/events',
    '/api/v1/subscription/billing/invoices','/api/v1/platform/enabled'])
    assert.equal(isEvaluationRecoveryRead('GET',path),true,path);
  for(const [method,path] of [
    ['GET','/api/v1/projects'],['GET','/api/v1/overview'],
    ['GET','/api/v1/onboarding/status'],['PATCH','/api/v1/subscription/current'],
    ['POST','/api/v1/subscription/evaluation/start'],
    ['POST','/api/v1/subscription/billing/invoices'],
    ['GET','/api/v1/subscription/billing/payments'],
    ['GET','/api/v1/subscription/current-extra'],
  ]) assert.equal(isEvaluationRecoveryRead(method,path),false,method+' '+path);
});
test('Evaluation database and API are opt-in, with no payment or auto renew',()=>{
 const fs = requireText('../apps/api/src/platform/subscription.service.ts');
 assert.match(fs,/process\.env\.EVALUATION_ACCESS_ENABLED !== 'true'/);
 assert.match(fs,/requiresCard:false,renewsAutomatically:false,priceMinor:0/);
 assert.match(fs,/now\(\)\+interval '168 hours'/);
 assert.match(fs,/cancel_at_period_end\)/);
 assert.doesNotMatch(fs,/paddleTransactionId|stripeCheckoutId/);
 const env=requireText('../apps/api/src/common/env.ts');
 assert.match(env,/EVALUATION_ACCESS_ENABLED: z\.enum\(\['true', 'false'\]\)\.default\('false'\)/);
 assert.match(env,/env\.DEPLOYMENT_ENV === 'production'/);
});
import {readFileSync} from 'node:fs';
function requireText(path){return readFileSync(new URL(path,import.meta.url),'utf8');}
