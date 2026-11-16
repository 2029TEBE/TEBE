// GAIZ2 second-person import authorization PRE-FLIGHT; NO DB writes or application.
// All records are authoritative tenant-RLS lookups, never browser-supplied objects.
// This is a verification contract, not an import grant, and returns zero operations.
import {createHash} from 'node:crypto';
const H=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(){throw Error('GAIZ import authorization or snapshot mismatch');}
function id(s){return typeof s==='string'&&UUID.test(s);}
function hash(s){return typeof s==='string'&&H.test(s);}
function serial(v){
 if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v);
 if(typeof v==='number'&&Number.isSafeInteger(v)&&!Object.is(v,-0))return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(serial).join(',')+']';
 if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype){
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+serial(v[k])).join(',')+'}';
 }
 fail();
}
const digest=x=>createHash('sha256').update(serial(x)).digest('hex');
/** Snapshot identity is derived from the actual RLS-fetched values. The
 * monotonically increasing revision is an interface dependency and must
 * eventually come from transactional application storage. */
export function fingerprintGaizTarget(snapshot){
 if(!snapshot||!id(snapshot.id)||!id(snapshot.tenantId)||
    !['project','portfolio'].includes(snapshot.kind)||
    !Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||
    !snapshot.fields||Object.getPrototypeOf(snapshot.fields)!==Object.prototype)fail();
 const allowed=snapshot.kind==='project'?['name']:['description'];
 if(Object.keys(snapshot.fields).sort().join('|')!==allowed.join('|'))fail();
 const value=snapshot.fields[allowed[0]];
 if(value!==null&&(typeof value!=='string'||value.length>4000))fail();
 return digest({id:snapshot.id,tenantId:snapshot.tenantId,
   kind:snapshot.kind,revision:snapshot.revision,fields:snapshot.fields});
}
/** A second human can approve only after the original metadata review and
 * custody validation; approval is still NOT permission to apply data. */
export function validateGaizImportAuthorization({
 context,stagingReview,custodyAttempt,preview,authorization,freshSnapshot,now=Date.now(),
}={}){
 if(!context||!id(context.tenantId)||!id(context.userId)||
    !context.capabilities?.includes('pmoa_admin')||
    !stagingReview||!id(stagingReview.id)||
    stagingReview.tenantId!==context.tenantId||stagingReview.status!=='approved'||
    !id(stagingReview.requestedBy)||!id(stagingReview.reviewedBy)||
    stagingReview.requestedBy===stagingReview.reviewedBy||
    !hash(stagingReview.sha256))fail();
 if(!custodyAttempt||custodyAttempt.tenantId!==context.tenantId||
    custodyAttempt.reviewId!==stagingReview.id||
    custodyAttempt.artifactSha256!==stagingReview.sha256||
    custodyAttempt.status!=='validated'||!hash(custodyAttempt.reportSha256))fail();
 if(!preview||preview.status!=='hash-only-field-preview'||
    preview.tenantId!==context.tenantId||
    preview.artifactSha256!==stagingReview.sha256||
    preview.reportSha256!==custodyAttempt.reportSha256||
    !id(preview.targetId)||!hash(preview.previewSha256)||
    preview.importAllowed!==false||preview.appliesData!==false||
    preview.containsPlaintext!==false)fail();
 if(!authorization||authorization.tenantId!==context.tenantId||
    authorization.stagingReviewId!==stagingReview.id||
    authorization.custodyAttemptId!==custodyAttempt.id||
    authorization.targetId!==preview.targetId||
    authorization.targetKind!==preview.targetKind||
    authorization.previewSha256!==preview.previewSha256||
    authorization.status!=='approved'||!id(authorization.requestedBy)||
    !id(authorization.approvedBy)||
    authorization.requestedBy===authorization.approvedBy||
    authorization.approvedBy===stagingReview.requestedBy||
    !Number.isFinite(now)||typeof authorization.expiresAt!=='string'||
    !Number.isFinite(Date.parse(authorization.expiresAt))||
    Date.parse(authorization.expiresAt)<=now)fail();
 if(!freshSnapshot||freshSnapshot.tenantId!==context.tenantId||
    freshSnapshot.id!==preview.targetId||freshSnapshot.kind!==preview.targetKind||
    !hash(authorization.targetSnapshotSha256)||
    fingerprintGaizTarget(freshSnapshot)!==authorization.targetSnapshotSha256)fail();
 const expected=preview.proposedFields;
 if(!Array.isArray(expected)||expected.length<1||expected.length>2||
    expected.some(x=>x.expectedRevision!==freshSnapshot.revision||
      !['requires_manual_review','no_change'].includes(x.decision)))fail();
 return Object.freeze({
  status:'second-review-validated-no-write',tenantId:context.tenantId,
  stagingReviewId:stagingReview.id,custodyAttemptId:custodyAttempt.id,
  previewSha256:preview.previewSha256,targetSnapshotSha256:authorization.targetSnapshotSha256,
  proposedOperations:Object.freeze([]),appliesData:false,importAllowed:false,
  requiresFreshCustody:true,requiresWriteTransactionReview:true,
 });
}
