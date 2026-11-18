import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCustodianMtlsTransport} from './gaiz-custodian-mtls.mjs';
const valid={
 endpoint:'https://custodian.example.com/v1/gaiz/validate',
 ca:'synthetic-ca',clientCert:'synthetic-client-cert',clientKey:'synthetic-client-tls-key',
 custodianId:'customer-custodian',serverSpkiSha256:'a'.repeat(64)
};
test('mTLS adapter is off by default and in production',()=>{
 const original=process.env.GAIZ_REMOTE_CUSTODY_TEST;
 const originalNode=process.env.NODE_ENV;
 try{
  delete process.env.GAIZ_REMOTE_CUSTODY_TEST;
  process.env.NODE_ENV='development';
  assert.throws(()=>makeCustodianMtlsTransport(valid),/refused/);
  process.env.GAIZ_REMOTE_CUSTODY_TEST='true';
  process.env.NODE_ENV='production';
  assert.throws(()=>makeCustodianMtlsTransport(valid),/refused/);
 }finally{
  if(original===undefined)delete process.env.GAIZ_REMOTE_CUSTODY_TEST;else process.env.GAIZ_REMOTE_CUSTODY_TEST=original;
  if(originalNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=originalNode;
 }
});
test('untrusted endpoint, missing TLS identity, port and credentials fail closed',()=>{
 const original=process.env.GAIZ_REMOTE_CUSTODY_TEST;
 const originalNode=process.env.NODE_ENV;
 process.env.NODE_ENV='development';process.env.GAIZ_REMOTE_CUSTODY_TEST='true';
 try{
  const forbidden=[
   {endpoint:'http://custodian.example.com/v1/gaiz/validate'},
   {endpoint:'https://127.0.0.1/v1/gaiz/validate'},
   {endpoint:'https://localhost/v1/gaiz/validate'},
   {endpoint:'https://custodian.example.com:8443/v1/gaiz/validate'},
   {endpoint:'https://custodian.example.com/v1/gaiz/validate?secret=x'},
   {endpoint:'https://attacker@custodian.example.com/v1/gaiz/validate'},
   {endpoint:'https://custodian.example.com/redirect'},
   {serverSpkiSha256:'bad'},
   {clientKey:null},
   {ca:null},
   {custodianId:'../../x'},
  ];
  for(const patch of forbidden)
   assert.throws(()=>makeCustodianMtlsTransport({...valid,...patch}),/refused/);
  assert.equal(typeof makeCustodianMtlsTransport(valid).requestAttestation,'function');
 }finally{
  if(original===undefined)delete process.env.GAIZ_REMOTE_CUSTODY_TEST;else process.env.GAIZ_REMOTE_CUSTODY_TEST=original;
  if(originalNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=originalNode;
 }
});
test('claim validation denies untrusted role, tenant and data without network',async()=>{
 const orig=process.env.GAIZ_REMOTE_CUSTODY_TEST,origNode=process.env.NODE_ENV;
 process.env.NODE_ENV='development';process.env.GAIZ_REMOTE_CUSTODY_TEST='true';
 try {
  const t=makeCustodianMtlsTransport(valid);
  for(const claim of [null,{},{
    tenantId:'tenant',reviewId:'review',artifactSha256:'a'.repeat(64),
    recipientKeyId:'key',actorId:'u',operation:'validate-only-no-import',
    custodianId:'customer-custodian',attemptId:'a',
  }])
   await assert.rejects(()=>t.requestAttestation(claim),/refused/);
 }finally{
  if(orig===undefined)delete process.env.GAIZ_REMOTE_CUSTODY_TEST;else process.env.GAIZ_REMOTE_CUSTODY_TEST=orig;
  if(origNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=origNode;
 }
});
