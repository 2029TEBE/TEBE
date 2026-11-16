import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import {verifyGaizWorkerAssignment} from './gaiz-worker-assignment.mjs';

const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const tenantId='00000000-0000-4000-8000-000000000001';
const workItemId='00000000-0000-4000-8000-000000000002';
const workerId='00000000-0000-4000-8000-000000000003';
const assignmentId='00000000-0000-4000-8000-000000000004';
const nowMs=1700000000050;
const claims=()=>({
  version:1,workerId,tenantId,workItemId,
  purpose:'gaiz_verify_worker',issuedAtMs:1700000000000,
  expiresAtMs:1700000060000,assignmentId,
});
const make=(data=claims())=>{
 const payload='{'+Object.keys(data).sort().map(k=>
   JSON.stringify(k)+':'+JSON.stringify(data[k])).join(',')+'}';
 const signature=sign(null,Buffer.from('GAIZ_WORKER_ASSIGNMENT_V1\n'+payload),privateKey).toString('base64url');
 return Buffer.from(JSON.stringify({claims:data,signature})).toString('base64url');
};
const opts=()=>({trustedIssuerPublicKey:publicKey,
  expectedWorker:workerId,expectedTenantId:tenantId,
  expectedWorkItemId:workItemId,
  expectedPurpose:'gaiz_verify_worker',nowMs});

test('issuer-signed verifier assignment returns a constrained receipt',()=>{
 const result=verifyGaizWorkerAssignment(make(),opts());
 assert.equal(result.authenticatedAssignment,true);
 assert.equal(result.databaseClaimRequired,true);
 assert.equal(result.importAllowed,false);
 assert.equal(result.assignmentId,assignmentId);
 assert.equal(Object.isFrozen(result),true);
});
test('wrong identity, purpose, key and tenant are refused',()=>{
 for(const change of [
   {expectedTenantId:workItemId},{expectedWorker:workItemId},
   {expectedWorkItemId:workerId},
   {expectedPurpose:'gaiz_execute_worker'},
   {trustedIssuerPublicKey:generateKeyPairSync('ed25519').publicKey},
 ])assert.throws(()=>verifyGaizWorkerAssignment(make(),{...opts(),...change}));
});
test('expired, excessive TTL, wrong purpose and altered claim are refused',()=>{
 const altered=[
   {expiresAtMs:nowMs},{issuedAtMs:nowMs+1},
   {expiresAtMs:nowMs+120001},{purpose:'gaiz_execute_worker'},
   {tenantId:workItemId},{version:2}, {operatorIsAdmin:true},
 ];
 for(const change of altered)
   assert.throws(()=>verifyGaizWorkerAssignment(make({...claims(),...change}),opts()));
 const raw=JSON.parse(Buffer.from(make(),'base64url').toString('utf8'));
 raw.claims.tenantId=workItemId;
 assert.throws(()=>verifyGaizWorkerAssignment(
   Buffer.from(JSON.stringify(raw)).toString('base64url'),opts()));
});
test('malformed and noncanonical tokens fail closed',()=>{
 for(const token of ['', 'not-base64!', 'AA', 'a'.repeat(2049)])
   assert.throws(()=>verifyGaizWorkerAssignment(token,opts()));
 assert.throws(()=>verifyGaizWorkerAssignment(make(),{...opts(),maxTtlMs:120001}));
});
