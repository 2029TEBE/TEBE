import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeGaizVerifyHandoff,authorizeGaizExecuteHandoff} from './gaiz-worker-handoff.mjs';

const t='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const q='00000000-0000-4000-8000-000000000003';
const importer='00000000-0000-4000-8000-000000000004';
const approver='00000000-0000-4000-8000-000000000005';
const submitter='00000000-0000-4000-8000-000000000006';
const sha='a'.repeat(64), mappingSha='b'.repeat(64);
const verifyPrincipal=()=>({kind:'gaiz_verify_worker',tenantId:t,authenticated:true,workItemId:q});
const verifyJob=()=>({tenantId:t,quarantineId:q,sha256:sha,state:'quarantined',revision:0});
const verifyEvidence=()=>({tenantId:t,quarantineId:q,sha256:sha,signatureVerified:true,
  aeadVerified:true,schemaVersion:1});
const executePrincipal=()=>({kind:'gaiz_execute_worker',tenantId:t,authenticated:true,
  userId:importer,workItemId:q});
const approvedJob=()=>({id:q,tenantId:t,state:'approved',revision:3,
  requestedBy:submitter,approvedBy:approver,sha256:sha,mappingSha256:mappingSha});
const decision=()=>({tenantId:t,jobId:q,actorId:approver,outcome:'approved',
  decidedAtMs:1000,revision:2});
const executeEvidence=()=>({tenantId:t,jobId:q,artifactSha256:sha,quarantineSha256:sha,
  proposalSha256:mappingSha,signatureVerified:true,aeadVerified:true,
  mappingVerified:true,replayClaimAvailable:true});

test('verified handoff is tenant-bound, inert, and revision-checked',()=>{
  const receipt=authorizeGaizVerifyHandoff(verifyJob(),verifyPrincipal(),verifyEvidence());
  assert.equal(receipt.importAllowed,false);
  assert.equal(receipt.nextState,'verified');
  assert.equal(receipt.expectedRevision,0);
  assert.equal(Object.isFrozen(receipt),true);
});
test('verifier cannot supply forged/cross-tenant evidence',()=>{
  for(const change of [
    {tenantId:other},{sha256:'c'.repeat(64)},
    {signatureVerified:false},{aeadVerified:false},{schemaVersion:2},
    {importAllowed:true},
  ]) assert.throws(()=>authorizeGaizVerifyHandoff(verifyJob(),verifyPrincipal(),
    {...verifyEvidence(),...change}));
  assert.throws(()=>authorizeGaizVerifyHandoff(verifyJob(),
    {...verifyPrincipal(),kind:'gaiz_execute_worker'},verifyEvidence()));
  assert.throws(()=>authorizeGaizVerifyHandoff({...verifyJob(),state:'verified'},
    verifyPrincipal(),verifyEvidence()));
});
test('approved executor handoff is draft-only and still requires atomic persistence',()=>{
  const plan=authorizeGaizExecuteHandoff(approvedJob(),executePrincipal(),
    decision(),executeEvidence(),1000+10000);
  assert.equal(plan.allowsOnlyDraft,true);
  assert.equal(plan.requiresAtomicReceipt,true);
  assert.equal(plan.nextState,'importing');
  assert.equal(Object.isFrozen(plan),true);
});
test('executor rejects privilege confusion, stale and self approvals, replay and changed digest',()=>{
  for(const change of [
    {kind:'gaiz_verify_worker'}, {tenantId:other},{userId:approver},
    {authenticated:false},{workItemId:other},
  ])assert.throws(()=>authorizeGaizExecuteHandoff(approvedJob(),
    {...executePrincipal(),...change},decision(),executeEvidence(),11000));
  for(const change of [
    {state:'imported'},{revision:4},{approvedBy:submitter},
    {sha256:'c'.repeat(64)},
  ])assert.throws(()=>authorizeGaizExecuteHandoff({...approvedJob(),...change},
    executePrincipal(),decision(),executeEvidence(),11000));
  for(const change of [
    {tenantId:other},{actorId:submitter},{outcome:'rejected'},
    {revision:1},{decidedAtMs:0},{isAdmin:true},
  ])assert.throws(()=>authorizeGaizExecuteHandoff(approvedJob(),
    executePrincipal(),{...decision(),...change},executeEvidence(),11000));
  for(const change of [
    {artifactSha256:'c'.repeat(64)}, {quarantineSha256:'c'.repeat(64)},
    {proposalSha256:'c'.repeat(64)}, {signatureVerified:false},
    {aeadVerified:false}, {mappingVerified:false},{replayClaimAvailable:false},
  ])assert.throws(()=>authorizeGaizExecuteHandoff(approvedJob(),
    executePrincipal(),decision(),{...executeEvidence(),...change},11000));
  assert.throws(()=>authorizeGaizExecuteHandoff(approvedJob(),executePrincipal(),
    decision(),executeEvidence(),1000+15*60*1000+1));
});
