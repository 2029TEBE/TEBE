/**
 * Inactive, development-only atomic PostgreSQL challenge claim.
 * A trusted ingress MUST pre-issue and persist SHA256(randomBytes(32)) before
 * returning the challenge to an authenticated worker. Do not accept a
 * challenge selected by the signed artifact, HTTP client, or worker.
 *
 * Must run in the SAME transaction as assignment claim and the authorized
 * operation; if the operation fails, both claims MUST roll back.
 * The database credential must be a separate, non-owner gaiz_*_worker role.
 */
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';

const deny=()=>{throw new Error('GAIZ workload challenge claim denied')};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PURPOSES=new Set(['gaiz_verify_worker','gaiz_execute_worker']);
const rows=value=>Array.isArray(value)?value:[];
const digest=raw=>{
  if(typeof raw!=='string'||raw.length>90||!/^[A-Za-z0-9_-]+$/.test(raw))deny();
  const bytes=Buffer.from(raw,'base64url');
  if(bytes.length!==32||bytes.toString('base64url')!==raw)deny();
  try { return createHash('sha256').update(bytes).digest('hex'); }
  finally {bytes.fill(0);}
};

/** Consume only a separately pre-issued challenge. No issuer insert occurs here. */
export async function claimGaizWorkloadChallengeInTransaction(tx,{
  challenge,tenantId,workerId,workItemId,purpose,credentialIssuer,
  credentialExpiresAtMs,nowMs,
}={}){
  if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')deny();
  if(!tx||typeof tx.execute!=='function'||
     ![tenantId,workerId,workItemId].every(v=>typeof v==='string'&&UUID.test(v))||
     !PURPOSES.has(purpose)||
     typeof credentialIssuer!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(credentialIssuer)||
     !Number.isSafeInteger(credentialExpiresAtMs)||
     !Number.isSafeInteger(nowMs)||nowMs<=0||nowMs>=credentialExpiresAtMs)deny();
  const challengeSha256=digest(challenge);
  const found=rows(await tx.execute(sql`
    SELECT current_user AS "dbRole",
           current_setting('app.tenant_id',true) AS "currentTenant"
  `));
  if(found.length!==1||found[0].dbRole!==purpose||found[0].currentTenant!==tenantId)deny();
  // One atomic UPDATE handles expiry and uniqueness across concurrent workers.
  // The pre-issued challenge row must bind the same worker, tenant, item,
  // purpose and issuer. clock_timestamp is authoritative, not nowMs.
  const consumed=rows(await tx.execute(sql`
    UPDATE gaiz_workload_challenges
       SET consumed_at = clock_timestamp()
     WHERE challenge_sha256 = decode(${challengeSha256},'hex')
       AND tenant_id = ${tenantId}::uuid
       AND worker_id = ${workerId}::uuid
       AND work_item_id = ${workItemId}::uuid
       AND purpose = ${purpose}
       AND credential_issuer = ${credentialIssuer}
       AND consumed_at IS NULL
       AND expires_at > clock_timestamp()
       AND clock_timestamp() < to_timestamp(${credentialExpiresAtMs}::double precision / 1000)
     RETURNING encode(challenge_sha256,'hex') AS "challengeSha256"
  `));
  if(consumed.length!==1||consumed[0].challengeSha256!==challengeSha256)deny();
  return Object.freeze({
    challengeSha256,claimAcquired:true,
    assignmentClaimStillRequired:true,
    independentTransportAuthenticationRequired:true,
    importAllowed:false,
  });
}
