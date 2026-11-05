import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPaddleSandboxAccount as verify} from './paddle-sandbox-account-preflight.mjs';

const key='pdl_sdbx_apikey_'+'a'.repeat(50);
const token='test_'+'b'.repeat(32);
const seller='slr_'+'c'.repeat(26);
const price='pri_'+'d'.repeat(26);
const destination='https://staging.invalid.example/api/v1/billing/paddle-webhook';
const secret='pdl_ntfset_'+'e'.repeat(26)+'_'+'f'.repeat(32);
const env=()=>({
  PADDLE_SANDBOX_PREFLIGHT:'READ_ONLY',BILLING_PROVIDER:'paddle',
  PADDLE_ENV:'sandbox',PADDLE_ENABLED:'false',
  PADDLE_SANDBOX_API_KEY:key,PADDLE_SANDBOX_ACCOUNT_ID:seller,
  PADDLE_SANDBOX_CLIENT_TOKEN:token,PADDLE_SANDBOX_PRICE_IDS:price,
  PADDLE_SANDBOX_WEBHOOK_URL:destination,PADDLE_SANDBOX_WEBHOOK_SECRET:secret,
});
const root=()=>({api:{environment:'sandbox'},caller:{
  auth_type:'api_key',account:{id:seller},permissions:['price.read','notification_setting.read'],
}});
function mock(calls,patch={}){
  return async(url,opts)=>{
    calls.push({url,opts});
    const name=new URL(url).pathname;
    let data=name==='/'?root():name==='/prices'?
      [{id:price,status:'active',billing_cycle:{interval:'month',frequency:1}}]:
      [{type:'url',active:true,destination,traffic_source:'platform',
        subscribed_events:['transaction.completed','adjustment.created','adjustment.updated']
         .map(name=>({name})),endpoint_secret_key:secret}];
    if(name==='/' && patch.environment) data={...root(),api:{environment:patch.environment}};
    if(name==='/prices' && patch.prices) data=patch.prices;
    if(name==='/notification-settings' && patch.notifications) data=patch.notifications;
    return {ok:true,status:200,json:async()=>({data})};
  };
}
test('nothing calls the network without explicit operator opt in and sandbox-only config',async()=>{
  const cases=[{...env(),PADDLE_SANDBOX_PREFLIGHT:''},
   {...env(),PADDLE_ENABLED:'true'},{...env(),PADDLE_ENV:'production'},
   {...env(),PADDLE_SANDBOX_API_KEY:'pdl_live_apikey_'+'a'.repeat(50)}];
  for(const e of cases){
    let count=0;
    const result=await verify({env:e,fetchImpl:async()=>{count++;throw Error('unexpected')}});
    assert.equal(result.accountVerified,false);
    assert.equal(result.realPaymentsEnabled,false);
    assert.equal(count,0);
  }
});
test('read-only identity, catalog and webhook proof returns booleans and no credentials',async()=>{
  const calls=[];const result=await verify({env:env(),fetchImpl:mock(calls)});
  assert.equal(result.sandboxSetupComplete,true);
  assert.equal(result.status,'ACCOUNT_READY');
  assert.deepEqual(calls.map(x=>new URL(x.url).pathname),
    ['/','/prices','/notification-settings']);
  for(const call of calls) {
    assert.equal(call.opts.method,'GET');
    assert.equal(new URL(call.url).origin,'https://sandbox-api.paddle.com');
    assert.equal(call.opts.redirect,'error');
  }
  assert.equal(JSON.stringify(result).includes(key),false);
  assert.equal(JSON.stringify(result).includes(secret),false);
  assert.equal(JSON.stringify(result).includes(seller),false);
});
test('a live API identity can never qualify',async()=>{
  const result=await verify({env:env(),fetchImpl:mock([],{environment:'production'})});
  assert.equal(result.accountVerified,false);
});
test('unapproved prices and webhook destination prevent readiness without hiding account verification',async()=>{
  const wrong=await verify({env:env(),fetchImpl:mock([],{prices:[]})});
  assert.equal(wrong.accountVerified,true);
  assert.equal(wrong.sandboxSetupComplete,false);
  const missing=await verify({env:env(),fetchImpl:mock([],{notifications:[]})});
  assert.equal(missing.notificationDestinationVerified,false);
  assert.equal(missing.sandboxSetupComplete,false);
});
test('production URL cannot be registered as an acceptable sandbox test destination',async()=>{
  const e={...env(),PADDLE_SANDBOX_WEBHOOK_URL:'https://app.theepmo.com/api/v1/billing/paddle-webhook'};
  const calls=[];const result=await verify({env:e,fetchImpl:mock(calls)});
  assert.equal(result.notificationDestinationVerified,false);
  assert.equal(calls.some(x=>x.url.includes('notification-settings')),false);
  assert.equal(result.sandboxSetupComplete,false);
});
test('no notification secret match never reports webhook readiness complete',async()=>{
  const e={...env(),PADDLE_SANDBOX_WEBHOOK_SECRET:'pdl_ntfset_'+'a'.repeat(26)+'_'+'b'.repeat(32)};
  const result=await verify({env:e,fetchImpl:mock([])});
  assert.equal(result.notificationDestinationVerified,true);
  assert.equal(result.webhookSecretMatched,false);
  assert.equal(result.sandboxSetupComplete,false);
});
test('invalid API response cannot be confused with account verification',async()=>{
  const result=await verify({env:env(),fetchImpl:async()=>({ok:false,status:403})});
  assert.equal(result.accountVerified,false);
  assert.equal(result.status,'NOT_VERIFIED');
});
