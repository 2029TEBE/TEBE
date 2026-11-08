import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyTeamWorkspaceSandboxCatalog as verify} from './paddle-verified-sandbox-api-preflight.mjs';
const price='pri_01m6x7w5zy16nktzjwg2ezas2d';
const product='pro_01m6x789k8kmvez6zk7cm17wdz';
const key='pdl_sdbx_apikey_'+'a'.repeat(32);
const env=()=>({PADDLE_CATALOG_PREFLIGHT:'READ_ONLY',BILLING_PROVIDER:'paddle',
 PADDLE_ENV:'sandbox',PADDLE_ENABLED:'false',DEPLOYMENT_ENV:'staging',PADDLE_SANDBOX_API_KEY:key});
const p=()=>({id:price,product_id:product,status:'active',type:'standard',
 billing_cycle:{interval:'month',frequency:1},trial_period:null,
 unit_price:{amount:'4900',currency_code:'USD'},
 unit_price_overrides:[],quantity:{minimum:1,maximum:100},tax_mode:'account_setting'});
const prod=()=>({id:product,status:'active',type:'standard',name:'THE EPMO — Team Workspace'});
const fake=(priceData=p(),productData=prod(),urls=[])=>async(url,options)=>{
 urls.push({url,options});
 return {ok:true,status:200,headers:{get:()=> 'application/json'},
 json:async()=>({data:url.includes('/prices/')?priceData:productData})};
};
test('reads exact price and product IDs from fixed sandbox GET origins only',async()=>{
 const calls=[];const r=await verify({env:env(),fetchImpl:fake(p(),prod(),calls)});
 assert.equal(r.ok,true);assert.equal(r.verified,true);
 assert.equal(r.realPaymentsEnabled,false);
 assert.equal(r.finalCustomerTotalVerified,false);
 assert.equal(r.taxMode,'account_setting');
 assert.deepEqual(calls.map(x=>x.url),[
 'https://sandbox-api.paddle.com/prices/'+price,
 'https://sandbox-api.paddle.com/products/'+product]);
 assert.ok(calls.every(x=>x.options.method==='GET'&&x.options.redirect==='error'));
});
test('unapproved environment, missing credentials cannot reach provider',async()=>{
 for(const patch of [{PADDLE_ENABLED:'true'},{PADDLE_ENV:'production'},
 {DEPLOYMENT_ENV:'production'},{PADDLE_CATALOG_PREFLIGHT:undefined},
 {PADDLE_SANDBOX_API_KEY:'pdl_live_apikey_bad'}]){
  let called=false;const r=await verify({env:{...env(),...patch},fetchImpl:async()=>{called=true;}});
  assert.equal(r.ok,false);assert.equal(called,false);
 }
});
test('rejects mismatched price, product, status, interval and currency',async()=>{
 for(const patch of [{product_id:'pro_'+'a'.repeat(26)},{status:'archived'},
 {billing_cycle:{interval:'year',frequency:1}},{billing_cycle:null},
 {unit_price:{amount:'4901',currency_code:'USD'}},
 {unit_price:{amount:'4900',currency_code:'SAR'}},{trial_period:{interval:'day',frequency:7}},
 {unit_price_overrides:[{country_codes:['SA'],unit_price:{amount:'5100',currency_code:'USD'}}]},
 {unit_price_overrides:null},{quantity:{minimum:2,maximum:100}},
 {quantity:{minimum:1,maximum:0}},
 {tax_mode:'unexpected'},{tax_mode:undefined}]){
  assert.equal((await verify({env:env(),fetchImpl:fake({...p(),...patch})})).ok,false);
 }
 assert.equal((await verify({env:env(),fetchImpl:fake(p(),{...prod(),status:'archived'})})).ok,false);
});
test('provider errors never leak secrets or API response',async()=>{
 const result=await verify({env:env(),fetchImpl:async()=>{throw new Error('secret_'+key)}});
 assert.equal(result.ok,false);
 assert.equal(JSON.stringify(result).includes(key),false);
});

test('tax configuration is reported but never mistaken for final settled total',async()=>{
 for(const mode of ['internal','external','location','account_setting']){
  const result=await verify({env:env(),fetchImpl:fake({...p(),tax_mode:mode})});
  assert.equal(result.ok,true);
  assert.equal(result.taxMode,mode);
  assert.equal(result.finalCustomerTotalVerified,false);
  assert.equal(result.realPaymentsEnabled,false);
 }
});
