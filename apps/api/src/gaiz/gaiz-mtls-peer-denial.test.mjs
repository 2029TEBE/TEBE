import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyGaizMtlsPeerCandidate} from './gaiz-mtls-peer-candidate.mjs';

test('GAIZ mTLS candidate denies missing and forged transport authority',()=>{
 const previous=process.env.GAIZ_DEV_ONLY;
 const priorNodeEnv=process.env.NODE_ENV;
 try{
  process.env.GAIZ_DEV_ONLY='true';
  process.env.NODE_ENV='test';
  const policy={trustedPeers:new Map(),nowMs:Date.now()};
  for(const socket of [null,{}, {encrypted:true,authorized:true,getProtocol:()=> 'TLSv1.3',getPeerCertificate:()=>({raw:Buffer.alloc(256)})}])
    assert.throws(()=>verifyGaizMtlsPeerCandidate(socket,policy),/identity denied/);
  assert.throws(()=>verifyGaizMtlsPeerCandidate(null,{trustedPeers:new Map(),nowMs:0}),/identity denied/);
  process.env.NODE_ENV='production';
  assert.throws(()=>verifyGaizMtlsPeerCandidate(null,policy),/identity denied/);
 }finally{
  if(previous===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=previous;
  if(priorNodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=priorNodeEnv;
 }
});
test('isolated mTLS candidate is not registered in the app',()=>{
 const app=readFileSync(new URL('../app.module.ts',import.meta.url),'utf8');
 assert.equal(app.includes('gaiz-mtls-peer-candidate'),false);
});
