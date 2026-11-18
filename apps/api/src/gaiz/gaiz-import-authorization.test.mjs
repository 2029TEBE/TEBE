import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprintGaizTarget,validateGaizImportAuthorization} from './gaiz-import-authorization.mjs';
const id=n=>String(n).padStart(8,'0')+'-1111-4111-8111-111111111111';
const tenant=id(1),reviewId=id(2),attemptId=id(3),targetId=id(4);
const user=id(5),requester=id(6),firstReviewer=id(7),secondReviewer=id(8);
const freshSnapshot={tenantId:tenant,id:targetId,kind:'project',revision:3,fields:{name:'Existing'}};
const stagingReview={tenantId:tenant,id:reviewId,status:'approved',requestedBy:requester,
 reviewedBy:firstReviewer,sha256:'a'.repeat(64)};
const custodyAttempt={id:attemptId,tenantId:tenant,reviewId,
 artifactSha256:stagingReview.sha256,reportSha256:'b'.repeat(64),status:'validated'};
const preview={status:'hash-only-field-preview',tenantId:tenant,targetId,targetKind:'project',
 artifactSha256:stagingReview.sha256,reportSha256:custodyAttempt.reportSha256,
 previewSha256:'c'.repeat(64),importAllowed:false,appliesData:false,containsPlaintext:false,
 proposedFields:[{targetField:'project.name',decision:'requires_manual_review',expectedRevision:3}]};
const authorization={tenantId:tenant,stagingReviewId:reviewId,custodyAttemptId:attemptId,
 targetId,targetKind:'project',previewSha256:preview.previewSha256,
 targetSnapshotSha256:fingerprintGaizTarget(freshSnapshot),
 status:'approved',requestedBy:user,approvedBy:secondReviewer,
 expiresAt:'2026-11-17T00:00:00.000Z'};
const args={context:{tenantId:tenant,userId:secondReviewer,capabilities:['pmoa_admin']},
 stagingReview,custodyAttempt,preview,authorization,freshSnapshot,
 now:Date.parse('2026-11-16T12:00:00.000Z')};
test('separate second review yields no-write receipt and exact snapshot hash',()=>{
 const x=validateGaizImportAuthorization(args);
 assert.equal(x.appliesData,false);assert.equal(x.importAllowed,false);
 assert.deepEqual(x.proposedOperations,[]);
 assert.equal(x.targetSnapshotSha256,fingerprintGaizTarget(freshSnapshot));
});
test('stale target revision/content and forged approvals refuse',()=>{
 for(const patch of [
  {freshSnapshot:{...freshSnapshot,revision:4}},
  {freshSnapshot:{...freshSnapshot,fields:{name:'Concurrent change'}}},
  {context:{...args.context,tenantId:id(12)}},
  {context:{...args.context,capabilities:[]}},
  {stagingReview:{...stagingReview,requestedBy:firstReviewer}},
  {custodyAttempt:{...custodyAttempt,status:'reserved'}},
  {custodyAttempt:{...custodyAttempt,artifactSha256:'e'.repeat(64)}},
  {preview:{...preview,previewSha256:'f'.repeat(64)}},
  {preview:{...preview,proposedFields:[{...preview.proposedFields[0],expectedRevision:4}]}},
  {authorization:{...authorization,approvedBy:user}},
  {authorization:{...authorization,approvedBy:requester}},
  {authorization:{...authorization,expiresAt:'2026-11-15T00:00:00.000Z'}},
  {authorization:{...authorization,status:'pending'}},
 ])assert.throws(()=>validateGaizImportAuthorization({...args,...patch}));
});
test('portfolio snapshot hashing requires allowlisted fields',()=>{
 const snap={tenantId:tenant,id:targetId,kind:'portfolio',revision:1,fields:{description:'Summary'}};
 assert.match(fingerprintGaizTarget(snap),/^[a-f0-9]{64}$/);
 assert.throws(()=>fingerprintGaizTarget({...snap,fields:{description:'Summary',health:'red'}}));
});
