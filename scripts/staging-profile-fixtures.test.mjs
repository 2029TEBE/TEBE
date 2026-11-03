import test from 'node:test';
import assert from 'node:assert/strict';
import { makeProfile,assertSeparate } from './staging-profile-fixtures.mjs';
import { validate } from './staging-region-policy.mjs';
test('profiles are distinct across all ten resources',()=>{
 const a=makeProfile('shared-sa'),b=makeProfile('dedicated-sa');
 assert.equal(assertSeparate(a,b),true);
});
test('both profiles deliberately fail region, SHA and digest approval',()=>{
 for(const p of ['shared-sa','dedicated-sa']){
  const errors=validate(makeProfile(p));
  assert.ok(errors.includes('region:not-approved'));
  assert.ok(errors.includes('sourceSha:not-immutable'));
  assert.ok(errors.includes('imageDigest:not-immutable'));
 }
});
test('resource overlap is rejected',()=>{
 const a=makeProfile('shared-sa'),b=makeProfile('dedicated-sa');
 b.databaseId=a.databaseId;
 assert.throws(()=>assertSeparate(a,b),/resource overlap:databaseId/);
});
test('unknown profile rejected',()=>assert.throws(()=>makeProfile('global'),/unsupported profile/));
test('no secret values or cloud authorization in generated templates',()=>{
 for(const p of ['shared-sa','dedicated-sa']){
  const a=makeProfile(p);
  assert.equal(a.deploymentAuthorized,false);
  assert.equal(a.secretsInRepo,false);
  assert.equal(a.usesStaticCloudKeys,false);
  assert.equal(a.releaseAccepted,false);
  assert.equal(a.providerEligibilityVerified,false);
  assert.equal(a.stripeMode,'test');
 }
});
