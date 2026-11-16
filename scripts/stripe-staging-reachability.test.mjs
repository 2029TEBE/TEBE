import test from 'node:test';
import assert from 'node:assert/strict';
import {stripeStagingHealthUrl,verifyStripeStagingReachability} from './stripe-staging-reachability.mjs';
const config=()=>({DEPLOYMENT_ENV:'staging',STRIPE_WEBHOOK_PUBLIC_URL:'https://api-staging.theepmo.com/api/v1/billing/stripe-webhook'});
const goodDns=async()=>[{address:'1.1.1.1',family:4}];
const goodHealth=async()=>({status:200,redirected:false,json:async()=>({ok:true,service:'pmo-api'})});
test('public DNS and exact THEEPMO health identity permit staging readiness',async()=>{
 const result=await verifyStripeStagingReachability(config(),{lookupFn:goodDns,fetchFn:goodHealth});
 assert.equal(result.ready,true);
 assert.equal(result.healthUrl,'https://api-staging.theepmo.com/health');
});
test('production URL, non-HTTPS and mismatched webhook path fail before network use',()=>{
 for(const url of ['https://app.theepmo.com/api/v1/billing/stripe-webhook',
  'http://api-staging.theepmo.com/api/v1/billing/stripe-webhook',
  'https://api-staging.theepmo.com/other',
  'https://api-staging.theepmo.com/api/v1/billing/stripe-webhook?test=1'])
  assert.throws(()=>stripeStagingHealthUrl({...config(),STRIPE_WEBHOOK_PUBLIC_URL:url}));
 assert.throws(()=>stripeStagingHealthUrl({...config(),DEPLOYMENT_ENV:'production'}));
});
test('no DNS or DNS errors fail before HTTP',async()=>{
 for(const lookupFn of [async()=>[],async()=>{throw Error('not found')}]) {
  let calls=0;
  await assert.rejects(verifyStripeStagingReachability(config(),{lookupFn,fetchFn:async()=>{calls++;return goodHealth()}}),/DNS/);
  assert.equal(calls,0);
 }
});
test('private IP addresses fail before HTTP',async()=>{
 for(const address of ['127.0.0.1','10.0.0.1','192.168.1.2','172.16.0.1','169.254.1.1','::1','fc00::1']) {
  let calls=0;
  await assert.rejects(verifyStripeStagingReachability(config(),{lookupFn:async()=>[{address}],fetchFn:async()=>{calls++;return goodHealth()}}),/DNS/);
  assert.equal(calls,0);
 }
});
test('redirects, wrong HTTP status and incorrect service identity fail closed',async()=>{
 for(const response of [
  {status:301,redirected:true,json:async()=>({ok:true,service:'pmo-api'})},
  {status:503,redirected:false,json:async()=>({ok:true,service:'pmo-api'})},
  {status:200,redirected:false,json:async()=>({ok:true,service:'unrelated'})},
  {status:200,redirected:false,json:async()=>{throw Error('bad json')}},
 ]) await assert.rejects(verifyStripeStagingReachability(config(),{lookupFn:goodDns,fetchFn:async()=>response}));
});
