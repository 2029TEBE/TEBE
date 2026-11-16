import test from 'node:test';
import assert from 'node:assert/strict';
import { gaizReplayIdentity, requireGaizOperation, transitionGaizImport } from './gaiz-workflow.mjs';

const actor = Object.freeze({
  tenantId: 'tenant-a', userId: 'import-worker',
  authenticated: true, entitled: true, workspaceMember: true,
  capabilities: ['read', 'pmoa_manage_projects', 'pmoa_approve', 'pmoa_view_financials'],
});
const base = (state='approved') => ({
  tenantId: 'tenant-a', artifactId: 'synthetic-artifact', id: 'test-job',
  state, revision: 2,
});
const importRequest = {
  expectedRevision: 2, nextState: 'importing',
  humanApproved: true, signatureValid: true, aeadValid: true,
  mappingValidated: true, replayClaimAcquired: true,
  entitled: true, approvedBy: 'different-approver',
};

test('tenant, membership, authentication, entitlement and capability must all match', () => {
  assert.equal(requireGaizOperation(actor,'preview','tenant-a'),true);
  for(const change of [
    {tenantId: 'tenant-b'}, {authenticated:false},
    {workspaceMember:false}, {entitled:false}, {capabilities:[]},
    {userId:null},
  ]) {
    assert.throws(()=>requireGaizOperation({...actor,...change},'preview','tenant-a'));
  }
  assert.throws(()=>requireGaizOperation(actor,'preview','tenant-b'));
  assert.throws(()=>requireGaizOperation(actor,'adminRecovery','tenant-a'));
});

test('approval cannot bypass signature, GCM, mapping, replay, entitlement or separation of duties', () => {
  const next=transitionGaizImport(base(),importRequest,actor);
  assert.equal(next.state,'importing');
  assert.equal(next.revision,3);
  assert.equal(base().revision,2);
  for (const field of ['humanApproved','signatureValid','aeadValid','mappingValidated','replayClaimAcquired','entitled']) {
    assert.throws(()=>transitionGaizImport(base(),{...importRequest,[field]:false},actor));
  }
  assert.throws(()=>transitionGaizImport(base(),{...importRequest,approvedBy:actor.userId},actor));
  assert.throws(()=>transitionGaizImport(base(),{...importRequest,expectedRevision:1},actor));
  assert.throws(()=>transitionGaizImport(base(),importRequest,{...actor,tenantId:'tenant-b'}));
});

test('state machine rejects terminal replays, invalid shortcuts and missing verifications', () => {
  assert.throws(()=>transitionGaizImport(base('imported'),importRequest,actor));
  assert.throws(()=>transitionGaizImport(base('quarantined'),importRequest,actor));
  assert.throws(()=>transitionGaizImport(base('quarantined'),{expectedRevision:2,nextState:'verified'},actor));
  assert.equal(transitionGaizImport(base('quarantined'),
    {expectedRevision:2,nextState:'verified',signatureValid:true},actor).state,'verified');
  assert.throws(()=>transitionGaizImport(base('verified'),
    {expectedRevision:2,nextState:'pending_approval'},actor));
});

test('replay identities bind issuer, tenant and artifact', () => {
  const a=gaizReplayIdentity({tenantId:'a',issuerKeyId:'issuer',artifactId:'id'});
  assert.notEqual(a,gaizReplayIdentity({tenantId:'b',issuerKeyId:'issuer',artifactId:'id'}));
  assert.notEqual(a,gaizReplayIdentity({tenantId:'a',issuerKeyId:'other',artifactId:'id'}));
  assert.throws(()=>gaizReplayIdentity({tenantId:'a',issuerKeyId:'',artifactId:'id'}));
});

test('human approval is a distinct, authorized transition before import',()=>{
  const job={...base('pending_approval'),requestedBy:'submitter'};
  const approved=transitionGaizImport(job,{
    expectedRevision:2,nextState:'approved',
    signatureValid:true,aeadValid:true,mappingValidated:true,entitled:true,
  },actor);
  assert.equal(approved.state,'approved');
  assert.throws(()=>transitionGaizImport(job,{
    expectedRevision:2,nextState:'approved',signatureValid:true,aeadValid:true,
    mappingValidated:true,entitled:true,
  },{...actor,userId:'submitter'}));
  assert.throws(()=>transitionGaizImport(job,{
    expectedRevision:2,nextState:'importing',...importRequest,
  },actor));
});
