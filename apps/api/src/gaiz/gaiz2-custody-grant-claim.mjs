/**
 * Inactive GAIZ2 custody grant replay claim.
 * Requires a separately verified signed custody-policy receipt, an exact
 * SHA256 digest of the signed grant token, and an independently authenticated
 * worker DB role. No unwrap, KMS call, import authorization, or public route.
 *
 * Execute in the same transaction as the already verified assignment claim
 * and any later reviewed operation: a rollback must undo this claim too.
 */
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
const deny=()=>{throw Error('GAIZ2 custody grant replay claim denied')};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA=/^[a-f0-9]{64}$/;
const bytesOf=x=>{
 if(typeof x!=='string'||!x||x.length>4096||!/^[A-Za-z0-9_-]+$/.test(x))deny();
 const b=Buffer.from(x,'base64url');
 if(!b.length||b.length>3072||b.toString('base64url')!==x)deny();
 return b;
};
const getRows=x=>Array.isArray(x)?x:[];

/** `verifiedGrant` MUST be returned by verifyGaiz2CustodyGrantCandidate
 * using a backend-pinned issuer and backend-derived expected metadata.
 * The caller must not supply a JSON object masquerading as a receipt.
 * A dedicated worker composition boundary enforces that provenance.
 */
export async function claimGaiz2CustodyGrantInTransaction(tx,{
 signedGrantToken,verifiedGrant,nowMs,
}={}){
 if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')deny();
 if(!tx||typeof tx.execute!=='function'||!verifiedGrant||
    verifiedGrant.signedCustodyPolicyVerified!==true||
    verifiedGrant.independentKmsAuthorizationRequired!==true||
    verifiedGrant.durableAssignmentClaimRequired!==true||
    verifiedGrant.replayControlledGrantRequired!==true||
    verifiedGrant.authorizationGranted!==false||
    verifiedGrant.kmsReleaseAllowed!==false||
    verifiedGrant.importAllowed!==false||
    !UUID.test(verifiedGrant.tenantId??'')||
    !UUID.test(verifiedGrant.workerId??'')||
    !UUID.test(verifiedGrant.workItemId??'')||
    !UUID.test(verifiedGrant.assignmentId??'')||
    !ID.test(verifiedGrant.custodyGrantIssuerId??'')||
    !ID.test(verifiedGrant.artifactId??'')||
    !ID.test(verifiedGrant.recipientKeyId??'')||
    !SHA.test(verifiedGrant.envelopeSha256??'')||
    !Number.isSafeInteger(nowMs)||nowMs<=0||
    !Number.isSafeInteger(verifiedGrant.custodyGrantExpiresAtMs)||
    nowMs>=verifiedGrant.custodyGrantExpiresAtMs)deny();
 const bytes=bytesOf(signedGrantToken);
 let tokenSha256;
 try{tokenSha256=createHash('sha256').update(bytes).digest('hex')}
 finally{bytes.fill(0)}
 const scoped=getRows(await tx.execute(sql`
  SELECT current_user AS "dbRole",
         current_setting('app.tenant_id',true) AS "currentTenant"
 `));
 if(scoped.length!==1||scoped[0].dbRole!=='gaiz_verify_worker'||
    scoped[0].currentTenant!==verifiedGrant.tenantId)deny();
 // A unique index prevents concurrent replay. PostgreSQL clock is
 // authoritative. Do not infer success from a resolved query promise.
 const inserted=getRows(await tx.execute(sql`
  INSERT INTO gaiz2_custody_grant_claims
   (token_sha256,tenant_id,worker_id,work_item_id,assignment_id,
    issuer_id,artifact_id,envelope_sha256,recipient_key_id,expires_at)
  SELECT decode(${tokenSha256},'hex'),
   ${verifiedGrant.tenantId}::uuid,${verifiedGrant.workerId}::uuid,
   ${verifiedGrant.workItemId}::uuid,${verifiedGrant.assignmentId}::uuid,
   ${verifiedGrant.custodyGrantIssuerId},
   ${verifiedGrant.artifactId},decode(${verifiedGrant.envelopeSha256},'hex'),
   ${verifiedGrant.recipientKeyId},
   to_timestamp(${verifiedGrant.custodyGrantExpiresAtMs}::double precision/1000)
  WHERE clock_timestamp()<to_timestamp(${verifiedGrant.custodyGrantExpiresAtMs}::double precision/1000)
  ON CONFLICT (token_sha256) DO NOTHING
  RETURNING encode(token_sha256,'hex') AS "tokenSha256"
 `));
 if(inserted.length!==1||inserted[0].tokenSha256!==tokenSha256)deny();
 return Object.freeze({
  tokenSha256,claimAcquired:true,
  independentKmsAuthorizationRequired:true,
  assignmentClaimRequired:true,
  authorizationGranted:false,kmsReleaseAllowed:false,importAllowed:false,
 });
}
