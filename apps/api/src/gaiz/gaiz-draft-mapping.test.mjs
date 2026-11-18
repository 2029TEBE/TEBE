import test from 'node:test';
import assert from 'node:assert/strict';
import {planSyntheticGaizGovernanceDraft} from './gaiz-draft-mapping.mjs';
const tenantId='00000000-0000-4000-8000-000000000001';
const evidence={
  tenantId,workspaceId:tenantId,quarantineId:'00000000-0000-4000-8000-000000000002',
  artifactId:'synthetic',issuerKeyId:'issuer-a',envelopeSha256:'a'.repeat(64),
  signatureValid:true,aeadValid:true,schemaMapped:true,entitled:true,
};
const content={schemaVersion:1,title:'Synthetic governance',summary:'Test report'};
test('strict draft proposal cannot execute writes or grant approval',()=>{
 const draft=planSyntheticGaizGovernanceDraft(content,evidence);
 assert.equal(draft.executable,false);
 assert.equal(draft.requiresHumanApproval,true);
 assert.equal(draft.targetType,'governance_report_draft');
 assert.deepEqual(Object.keys(draft.fields).sort(),['summary','title']);
});
test('cross-tenant, unverified or malicious report mapping denied',()=>{
 for(const bad of [
   {workspaceId:'00000000-0000-4000-8000-000000000099'},
   {signatureValid:false},{aeadValid:false},{entitled:false},
   {schemaMapped:false},{quarantineId:'bad'}, {envelopeSha256:'bad'},
 ]) assert.throws(()=>planSyntheticGaizGovernanceDraft(content,{...evidence,...bad}));
 for(const bad of [
   {...content,html:'<script>alert(1)</script>'},
   {...content,status:'approved'},
   {...content,title:'<img src=x>'},
   {...content,schemaVersion:2},
 ]) assert.throws(()=>planSyntheticGaizGovernanceDraft(bad,evidence));
});


test('mapping output stays immutable, inert and strips all unapproved authority',()=>{
 const proposal=planSyntheticGaizGovernanceDraft(content,evidence);
 assert.equal(Object.isFrozen(proposal),true);
 assert.equal(Object.isFrozen(proposal.fields),true);
 assert.equal(Object.isFrozen(proposal.source),true);
 for(const name of ['approved','role','actorId','rawCiphertext','sql','html','authorizationGranted','importAllowed'])
   assert.equal(Object.hasOwn(proposal,name),false);
 assert.throws(()=>planSyntheticGaizGovernanceDraft({...content,summary:'<svg/onload=alert(1)>'},evidence),/rejected/);
});
