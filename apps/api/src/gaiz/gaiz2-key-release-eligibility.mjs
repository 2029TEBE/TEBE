/**
 * GAIZ2 candidate key-release eligibility gate.
 * Inactive / development only. This code cannot authorize KMS operations.
 * ALL evidence is backend-provided, obtained from a separately authenticated
 * worker and authoritative transaction results, never an HTTP payload.
 * No private keys, unwrap or network calls.
 */
const DENIED='GAIZ2 key-release eligibility denied';
const deny=()=>{throw new Error(DENIED)};
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const exact=(value,keys)=>value!==null&&typeof value==='object'&&
 !Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&
 Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const binding=['tenantId','workerId','workItemId','assignmentId',
 'artifactId','envelopeSha256','recipientKeyId'];
const claimFields=[...binding,'tokenSha256','claimAcquired','dbRole',
 'databaseTransactionId','expiresAtMs'];
const keyFields=['tenantId','recipientKeyId','keyVersion','state',
 'notBeforeMs','notAfterMs','revokedAtMs','dbRole','databaseTransactionId'];
const assignmentFields=[...binding,'claimAcquired','dbRole','databaseTransactionId'];
const verifyFields=[...binding,'signedEnvelopeVerified','issuerTrusted'];
const policyFields=[...binding,'signedCustodyPolicyVerified','independentKmsAuthorizationRequired'];
const match=(expected,item)=>binding.every(k=>item[k]===expected[k]);
/**
 * Does NOT return an authorization or a KMS token; it only validates
 * whether independently sourced evidence is eligible to be submitted
 * to a separately authenticated, policy-enforcing KMS gateway.
 */
export function evaluateGaiz2ReleaseEligibility({
 expected,verifiedEnvelope,verifiedCustodyPolicy,
 grantClaim,assignmentClaim,recipientKey,nowMs,
}={}){
 if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')deny();
 if(!exact(expected,binding)||!UUID.test(expected.tenantId)||
    !UUID.test(expected.workerId)||!UUID.test(expected.workItemId)||
    !UUID.test(expected.assignmentId)||!KEY.test(expected.artifactId)||
    !KEY.test(expected.recipientKeyId)||!SHA.test(expected.envelopeSha256)||
    !Number.isSafeInteger(nowMs)||nowMs<=0)deny();
 if(!exact(verifiedEnvelope,verifyFields)||!match(expected,verifiedEnvelope)||
    verifiedEnvelope.signedEnvelopeVerified!==true||
    verifiedEnvelope.issuerTrusted!==true)deny();
 if(!exact(verifiedCustodyPolicy,policyFields)||!match(expected,verifiedCustodyPolicy)||
    verifiedCustodyPolicy.signedCustodyPolicyVerified!==true||
    verifiedCustodyPolicy.independentKmsAuthorizationRequired!==true)deny();
 if(!exact(grantClaim,claimFields)||!match(expected,grantClaim)||
    grantClaim.claimAcquired!==true||!SHA.test(grantClaim.tokenSha256)||
    !Number.isSafeInteger(grantClaim.expiresAtMs)||grantClaim.expiresAtMs<=nowMs||
    grantClaim.dbRole!=='gaiz_verify_worker')deny();
 if(!exact(assignmentClaim,assignmentFields)||!match(expected,assignmentClaim)||
    assignmentClaim.claimAcquired!==true||
    assignmentClaim.dbRole!=='gaiz_verify_worker')deny();
 if(!exact(recipientKey,keyFields)||recipientKey.tenantId!==expected.tenantId||
    recipientKey.recipientKeyId!==expected.recipientKeyId||
    recipientKey.dbRole!=='gaiz_key_registry_reader'||
    !KEY.test(recipientKey.keyVersion)||
    recipientKey.state!=='active'||
    !Number.isSafeInteger(recipientKey.notBeforeMs)||
    !Number.isSafeInteger(recipientKey.notAfterMs)||
    recipientKey.notBeforeMs>nowMs||recipientKey.notAfterMs<=nowMs||
    recipientKey.revokedAtMs!==null)deny();
 if(typeof grantClaim.databaseTransactionId!=='string'||
    !UUID.test(grantClaim.databaseTransactionId)||
    assignmentClaim.databaseTransactionId!==grantClaim.databaseTransactionId||
    recipientKey.databaseTransactionId!==grantClaim.databaseTransactionId)deny();
 return Object.freeze({
  tenantId:expected.tenantId,
  workerId:expected.workerId,
  workItemId:expected.workItemId,
  assignmentId:expected.assignmentId,
  envelopeSha256:expected.envelopeSha256,
  recipientKeyId:expected.recipientKeyId,
  keyVersion:recipientKey.keyVersion,
  releaseCandidateEligible:true,
  independentLiveKmsAuthorizationRequired:true,
  atomicReleaseConsumptionRequired:true,
  authoritativeKeyRevocationRecheckRequired:true,
  kmsReleaseAllowed:false,
  authorizationGranted:false,
  importAllowed:false,
 });
}
