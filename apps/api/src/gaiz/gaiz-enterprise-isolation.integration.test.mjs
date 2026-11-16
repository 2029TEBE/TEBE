// Source-only integration regression. No app route, DB, payments, credentials or keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planSyntheticGaizGovernanceDraft} from './gaiz-draft-mapping.mjs';
import {requireGaizOperation,transitionGaizImport,gaizReplayIdentity} from './gaiz-workflow.mjs';

const tenantId='00000000-0000-4000-8000-000000000001';
const otherTenant='00000000-0000-4000-8000-000000000009';
const submittedBy='00000000-0000-4000-8000-000000000002';
const reviewer='00000000-0000-4000-8000-000000000003';
const evidence={
  tenantId,workspaceId:tenantId,
  quarantineId:'00000000-0000-4000-8000-000000000004',
  artifactId:'synthetic',issuerKeyId:'issuer-a',
  envelopeSha256:'a'.repeat(64),
  signatureValid:true,aeadValid:true,schemaMapped:true,entitled:true,
};
const content={schemaVersion:1,title:'Synthetic governance',summary:'No customer information'};
const actor={tenantId,userId:reviewer,authenticated:true,entitled:true,
  workspaceMember:true,capabilities:['read','pmoa_approve','pmoa_manage_projects']};
test('mapped draft is non-executable even when policy grants read and approval capability',()=>{
  const draft=planSyntheticGaizGovernanceDraft(content,evidence);
  assert.equal(requireGaizOperation(actor,'preview',tenantId),true);
  assert.equal(draft.executable,false);
  assert.equal(draft.requiresHumanApproval,true);
  assert.equal(Object.hasOwn(draft,'approvedBy'),false);
  assert.equal(Object.hasOwn(draft,'authorizationGranted'),false);
  assert.deepEqual(Object.keys(draft.fields).sort(),['summary','title']);
});
test('a draft proposal never bypasses distinct-person approval, revisions or tenant scope',()=>{
  const job={tenantId,artifactId:'synthetic',id:'synthetic-work-item',
    requestedBy:submittedBy,state:'pending_approval',revision:0};
  const request={nextState:'approved',expectedRevision:0,
    signatureValid:true,aeadValid:true,mappingValidated:true,entitled:true};
  const next=transitionGaizImport(job,request,actor);
  assert.equal(next.state,'approved');
  assert.equal(next.revision,1);
  assert.equal(job.state,'pending_approval');
  assert.throws(()=>transitionGaizImport(job,request,{...actor,userId:submittedBy}));
  assert.throws(()=>transitionGaizImport(job,{...request,expectedRevision:1},actor));
  assert.throws(()=>transitionGaizImport(job,request,{...actor,tenantId:otherTenant}));
  assert.throws(()=>planSyntheticGaizGovernanceDraft(content,{...evidence,workspaceId:otherTenant}));
  assert.notEqual(
    gaizReplayIdentity({tenantId,issuerKeyId:'issuer-a',artifactId:'synthetic'}),
    gaizReplayIdentity({tenantId:otherTenant,issuerKeyId:'issuer-a',artifactId:'synthetic'})
  );
});
