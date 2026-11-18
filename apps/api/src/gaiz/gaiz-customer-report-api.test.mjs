import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizCustomerReportService} from './gaiz-customer-report-service.mjs';
import {createGaizReportHttpHandlers} from './gaiz-report-http.mjs';

const owner='123e4567-e89b-42d3-a456-426614174000';
const orderId='223e4567-e89b-42d3-a456-426614174000';
const jobId='323e4567-e89b-42d3-a456-426614174000';
const artifactId='423e4567-e89b-42d3-a456-426614174000';
const sessionToken='ogs1.'+'a'.repeat(43);
const order={id:orderId,customerId:owner,toolId:'gaiz.executive-brief.v1',
 currency:'USD',amountMinor:1000,providerTransactionId:'txn-1',state:'completed',revision:4};
const job={id:jobId,orderId,customerId:owner,state:'completed'};
const artifact={id:artifactId,jobId,customerId:owner,format:'html',
 revokedAt:null,verifiedByServer:true,expiresAt:new Date(Date.now()+86400000)};
const principal={authenticated:true,identityProvider:'oidc',epmoTenantBound:false,
 customerId:owner,issuer:'https://example.test/',subject:'customer-1',sessionId:'session-1'};
const source={
 sessions:{async requireCustomer(){return principal}},
 catalogue:{publicList(){return [{toolId:'gaiz.executive-brief.v1'}]},
  requireRequest(){return {customerId:owner,toolId:'gaiz.executive-brief.v1',
    workerKey:'gaiz.executive-brief.v1',productId:'p',format:'html',
    inputs:{title:'Example'},priceMinor:1000,currency:'USD'}}},
 orders:{async getOrder(){return order}},
 jobs:{async submitFromEntitlement(){return {jobId,orderId,customerId:owner,state:'queued'}},
  async getOwnedJob(){return job}},
 artifacts:{async getMetadata(){return artifact},
  async readAuthorized(){return {bytes:Buffer.from('safe report'),format:'html',
   contentType:'text/html; charset=utf-8',cacheControl:'no-store',
   downloadDisposition:'attachment'}}},
 audit:{async record(){}}
};
const service=overrides=>createGaizCustomerReportService({
 enabled:true,...source,...overrides
});
test('disabled service cannot start without trusted auth/store',()=>{
 assert.throws(()=>createGaizCustomerReportService());
});
test('owned job submission is allowed only from server-admitted entitlement',async()=>{
 const s=service(),r=await s.submit({
  sessionToken,orderId,request:{toolId:'gaiz.executive-brief.v1',format:'html',inputs:{}},
  serverProduct:{},serverPolicy:{},idempotencyKey:'test-idempotency-12345678'});
 assert.deepEqual(r,{jobId,status:'queued'});
 assert.deepEqual(await s.status({sessionToken,jobId}),{jobId,status:'completed'});
});
test('wrong customer never sees another customer job',async()=>{
 const s=service({jobs:{...source.jobs,async getOwnedJob(){return {...job,customerId:'another'}}}});
 await assert.rejects(s.status({sessionToken,jobId}));
 await assert.rejects(s.download({sessionToken,jobId,artifactId}));
});
test('report only downloads from completed and unrevoked record',async()=>{
 const s=service();
 const r=await s.download({sessionToken,jobId,artifactId});
 assert.equal(r.filename,'gaiz-report.html');
 assert.equal(r.contentDisposition,'attachment');
 assert.equal(r.bytes.toString(),'safe report');
 const unverified=service({artifacts:{...source.artifacts,
   async getMetadata(){return {...artifact,verifiedByServer:false}}}});
 await assert.rejects(unverified.download({sessionToken,jobId,artifactId}));
 const missingProof=service({artifacts:{...source.artifacts,
   async getMetadata(){const {verifiedByServer,...unverifiedRecord}=artifact;return unverifiedRecord}}});
 await assert.rejects(missingProof.download({sessionToken,jobId,artifactId}));
 const missingRevocation=service({artifacts:{...source.artifacts,
   async getMetadata(){const {revokedAt,...incomplete}=artifact;return incomplete}}});
 await assert.rejects(missingRevocation.download({sessionToken,jobId,artifactId}));
 const revoked=service({artifacts:{...source.artifacts,
   async getMetadata(){return {...artifact,revokedAt:new Date()}}}});
 await assert.rejects(revoked.download({sessionToken,jobId,artifactId}));
 const refunded=service({orders:{async getOrder(){return {...order,state:'refunded'}}}});
 await assert.rejects(refunded.download({sessionToken,jobId,artifactId}));
});
function res(){
 const headers={};return {headers,setHeader(k,v){headers[k]=v},
 status(code){this.statusCode=code;return this},json(o){this.body=o;return this},
 end(b){this.bytes=b;return this}};
}
const csrf='b'.repeat(43);
function req({origin='https://orgaiz.example.test',cookies={
 '__Host-orgaiz_session':sessionToken,'__Host-orgaiz_csrf':csrf},
 body={},params={},secure=true}={}){
 return {secure,cookies,body,params,get(k){
  return {host:'orgaiz.example.test',origin,
   'x-orgaiz-csrf':csrf,'content-type':'application/json'}[k.toLowerCase()]
 }};
}
test('HTTP adapter never trusts prices in browser JSON',async()=>{
 let productCalls=0;
 const h=createGaizReportHttpHandlers({enabled:true,
  siteOrigin:'https://orgaiz.example.test',service:service(),
  productResolver:async()=>{productCalls++;return {product:{},policy:{}}}});
 const b={orderId,idempotencyKey:'test-idempotency-12345678',
  request:{toolId:'gaiz.executive-brief.v1',format:'html',inputs:{}}};
 const response=res();await h.submit(req({body:b}),response);
 assert.equal(response.statusCode,202);
 assert.equal(productCalls,1);
 assert.equal(response.headers['Cache-Control'],'private, no-store');
 await assert.rejects(h.submit(req({origin:'https://evil.example.test',body:b}),res()));
 await assert.rejects(h.submit(req({body:{...b,priceMinor:1}}),res()));
});
test('HTTP submit rejects malformed payload before product resolution',async()=>{
 let calls=0;
 const handlers=createGaizReportHttpHandlers({
  enabled:true,siteOrigin:'https://orgaiz.example.test',
  service:service(),productResolver:async()=>{calls++;return {product:{},policy:{}}}
 });
 const valid={orderId,idempotencyKey:'test-idempotency-12345678',
  request:{toolId:'gaiz.executive-brief.v1',format:'html',inputs:{}}};
 const invalid=[
  {...valid,idempotencyKey:'short'},
  {...valid,idempotencyKey:'a'.repeat(129)},
  {...valid,request:{...valid.request,toolId:'../../bad'}},
  {...valid,request:{...valid.request,format:'exe'}},
  {...valid,request:{...valid.request,inputs:[]}},
  {...valid,request:null}
 ];
 for(const body of invalid)await assert.rejects(handlers.submit(req({body}),res()));
 assert.equal(calls,0);
});
test('HTTP downloads set no-store attachment headers',async()=>{
 const h=createGaizReportHttpHandlers({enabled:true,
  siteOrigin:'https://orgaiz.example.test',service:service(),
  productResolver:async()=>({product:{},policy:{}})});
 const r=res();await h.download(req({params:{jobId,artifactId}}),r);
 assert.equal(r.headers['Content-Disposition'],'attachment; filename="gaiz-report.html"');
 assert.equal(r.headers['Content-Type'],'text/html; charset=utf-8');
 assert.equal(r.bytes.toString(),'safe report');
});

test('customer report service refuses invalid OIDC principals and all tenant-bound identities',async()=>{
 const invalid=[
  {...principal,authenticated:false},
  {...principal,identityProvider:'epmo'},
  {...principal,epmoTenantBound:true},
  {...principal,customerId:'not-a-uuid'},
  {...principal,issuer:''},
  {...principal,subject:''},
  {...principal,sessionId:''}
 ];
 for(const identity of invalid){
  const s=service({sessions:{async requireCustomer(){return identity}}});
  await assert.rejects(s.status({sessionToken,jobId}));
  await assert.rejects(s.download({sessionToken,jobId,artifactId}));
 }
});
test('session tokens cannot be blank, malformed or arbitrary bearer values',async()=>{
 const s=service();
 for(const value of [undefined,'','Bearer token','ogs1.short','ogs1.'+'+'.repeat(43)]){
  await assert.rejects(s.status({sessionToken:value,jobId}));
 }
});
test('artifact download fails closed for mismatched, expired and unfinished records',async()=>{
 const another='523e4567-e89b-42d3-a456-426614174000';
 const variants=[
  {jobs:{...source.jobs,async getOwnedJob(){return {...job,state:'queued'}}}},
  {jobs:{...source.jobs,async getOwnedJob(){return {...job,orderId:another}}}},
  {artifacts:{...source.artifacts,async getMetadata(){return {...artifact,customerId:another}}}},
  {artifacts:{...source.artifacts,async getMetadata(){return {...artifact,jobId:another}}}},
  {artifacts:{...source.artifacts,async getMetadata(){return {...artifact,expiresAt:new Date(0)}}}},
  {artifacts:{...source.artifacts,async readAuthorized(){return {...(await source.artifacts.readAuthorized()),cacheControl:'public'}}}},
  {artifacts:{...source.artifacts,async readAuthorized(){return {...(await source.artifacts.readAuthorized()),downloadDisposition:'inline'}}}}
 ];
 for(const override of variants){
  await assert.rejects(service(override).download({sessionToken,jobId,artifactId}));
 }
});
test('HTTP adapter denies missing CSRF, wrong host, insecure request and cross-origin submit',async()=>{
 const handlers=createGaizReportHttpHandlers({
  enabled:true,siteOrigin:'https://orgaiz.example.test',
  service:service(),productResolver:async()=>({product:{},policy:{}})
 });
 const body={orderId,idempotencyKey:'test-idempotency-12345678',
  request:{toolId:'gaiz.executive-brief.v1',format:'html',inputs:{}}};
 const normal=req({body});
 const missingCsrf=req({body,cookies:{'__Host-orgaiz_session':sessionToken}});
 const invalidHost={...normal,get(k){return k==='host'?'evil.example.test':normal.get(k)}};
 const badCsrf={...normal,get(k){return k==='x-orgaiz-csrf'?'invalid':normal.get(k)}};
 for(const value of [missingCsrf,invalidHost,badCsrf,req({body,secure:false}),
  req({body,origin:'https://evil.example.test'})]){
  await assert.rejects(handlers.submit(value,res()));
 }
});
test('HTTP download rejects malformed identifiers and unsafe origin host',async()=>{
 const h=createGaizReportHttpHandlers({
  enabled:true,siteOrigin:'https://orgaiz.example.test',
  service:service(),productResolver:async()=>({product:{},policy:{}})
 });
 const valid=req({params:{jobId,artifactId}});
 const otherHost={...valid,get(k){return k==='host'?'evil.example.test':valid.get(k)}};
 for(const value of [
  req({params:{jobId:'../../outside',artifactId}}),
  req({params:{jobId,artifactId:'not-a-uuid'}}),
  req({params:{jobId,artifactId},secure:false}),otherHost
 ])await assert.rejects(h.download(value,res()));
});
