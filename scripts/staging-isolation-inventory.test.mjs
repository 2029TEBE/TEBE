import test from 'node:test';
import assert from 'node:assert/strict';
import { makeProfile } from './staging-profile-fixtures.mjs';
import { verifyIsolation } from './staging-isolation-inventory.mjs';

function validInventory() {
  const shared=makeProfile('shared-sa');
  const dedicated=makeProfile('dedicated-sa');
  for(const p of [shared,dedicated]) {
    p.provider='approved-placeholder';
    p.region='sa-approved-region';
    p.approvedRegions=['sa-approved-region'];
    p.sourceSha='a'.repeat(40);
    p.imageDigest='sha256:'+'b'.repeat(64);
  }
  return {profiles:[shared,dedicated]};
}
test('separate Saudi profiles pass only offline inventory contract',()=>{
  const result=verifyIsolation(validInventory());
  assert.deepEqual(result.errors,[]);
  assert.equal(result.valid,true);
  assert.equal(result.physicalIsolationVerified,false);
  assert.equal(result.releaseAccepted,false);
});
test('rejects resource collision across matching types',()=>{
  const input=validInventory();
  input.profiles[1].databaseId=input.profiles[0].databaseId;
  assert.ok(verifyIsolation(input).errors.includes('overlap:databaseId'));
});
test('rejects collision across different resource types',()=>{
  const input=validInventory();
  input.profiles[1].storageId=input.profiles[0].databaseId;
  assert.ok(verifyIsolation(input).errors.includes('duplicate-resource-id'));
});
test('rejects incomplete inventory',()=>{
  assert.deepEqual(verifyIsolation({profiles:[]}).errors,['inventory:invalid']);
});
test('rejects invalid or missing resource identifiers',()=>{
  const input=validInventory();
  delete input.profiles[1].kmsKeyId;
  assert.ok(verifyIsolation(input).errors.includes('dedicated:invalid:kmsKeyId'));
});
test('never accepts deployment authorization or fabricated external evidence',()=>{
  const input=validInventory();
  input.profiles[0].deploymentAuthorized=true;
  input.profiles[1].providerEligibilityVerified=true;
  assert.ok(verifyIsolation(input).errors.includes('shared:authorization-must-be-disabled'));
  assert.ok(verifyIsolation(input).errors.includes('dedicated:external-evidence-must-remain-unverified'));
});
test('rejects unapproved regions and live billing',()=>{
  const input=validInventory();
  input.profiles[0].region='other';
  input.profiles[1].stripeMode='live';
  const errors=verifyIsolation(input).errors;
  assert.ok(errors.includes('shared:policy:region:not-approved'));
  assert.ok(errors.includes('dedicated:policy:billing:not-test-only'));
});
