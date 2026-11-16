import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { bindGaizWorkerIdentity } from './gaiz-workload-binding.mjs';

const issuer=generateKeyPairSync('ed25519');
const workerId='00000000-0000-4000-8000-000000000003';
const tenantId='00000000-0000-4000-8000-000000000001';
const workItemId='00000000-0000-4000-8000-000000000002';
const assignmentId='00000000-0000-4000-8000-000000000004';
const nowMs=1700000000050;
const purpose='gaiz_verify_worker';
const workload=()=>({
  workerId,role:purpose,credentialIssuer:'synthetic-test-CA',
  credentialExpiresAtMs:1700000090000,
});
const opts=()=>({
  workload:workload(),tenantId,workItemId,purpose,
  trustedIssuerPublicKey:issuer.publicKey,nowMs,
});
const claims=()=>({
  version:1,workerId,tenantId,workItemId,purpose,
  assignmentId,issuedAtMs:1700000000000,expiresAtMs:1700000060000,
});
const token=(claimsObject=claims())=>{
  const canonical='{'+Object.keys(claimsObject).sort().map(k=>
    JSON.stringify(k)+':'+JSON.stringify(claimsObject[k])).join(',')+'}';
  const signature=sign(null,Buffer.from('GAIZ_WORKER_ASSIGNMENT_V1\n'+canonical),
    issuer.privateKey).toString('base64url');
  return Buffer.from(JSON.stringify({claims:claimsObject,signature})).toString('base64url');
};

test('signed assignment matches independent workload identity and remains non-executable',()=>{
  const result=bindGaizWorkerIdentity(token(),opts());
  assert.equal(result.workerId,workerId);
  assert.equal(result.databaseClaimRequired,true);
  assert.equal(result.importAllowed,false);
  assert.equal(result.workloadCredentialIssuer,'synthetic-test-CA');
  assert.equal(Object.isFrozen(result),true);
});

test('workload identity, role and tenant mismatch fail closed',()=>{
  for(const change of [
    {workerId:workItemId},{role:'gaiz_execute_worker'},
    {credentialExpiresAtMs:nowMs},{credentialIssuer:''},
    {authenticated:true},
  ])assert.throws(()=>bindGaizWorkerIdentity(token(),{
    ...opts(),workload:{...workload(),...change},
  }));
  for(const change of [
    {tenantId:workItemId},{workItemId:tenantId},
    {purpose:'gaiz_execute_worker'},
    {trustedIssuerPublicKey:generateKeyPairSync('ed25519').publicKey},
  ])assert.throws(()=>bindGaizWorkerIdentity(token(),{...opts(),...change}));
});

test('altered, expired or replay-ready assignment never grants execution',()=>{
  assert.throws(()=>bindGaizWorkerIdentity(token({...claims(),tenantId:workItemId}),opts()));
  assert.throws(()=>bindGaizWorkerIdentity(token(),{...opts(),nowMs:1700000060000}));
  assert.throws(()=>bindGaizWorkerIdentity(token(),{...opts(),workload:{...workload(),credentialExpiresAtMs:1700000000000}}));
});
