/**
 * GAIZ development-only challenge issuance candidate.
 *
 * Must be invoked only from a trusted Node TLS server secureConnection
 * callback with a backend-owned fingerprint registry and authorization
 * policy. The challenge is generated here (never supplied by the peer),
 * and is returned only after a digest row is durably inserted by the
 * separate gaiz_challenge_issuer PostgreSQL role.
 *
 * No public route, KMS, signing key, worker execution or production use.
 */
import {randomBytes, createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {verifyGaizMtlsPeerCandidate} from './gaiz-mtls-peer-candidate.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny=()=>{throw Error('GAIZ challenge issuance denied')};
const rows=value=>Array.isArray(value)?value:[];
const AUTH_ROLE='gaiz_challenge_issuer';

/**
 * `authorizeWorkerWorkItem` is a separate backend-owned policy lookup:
 * it must check worker, tenant, work-item, role, enrollment and revocation
 * against trusted tenant data. Supplying a callback is NOT proof of identity.
 * The isolated issuer transaction must commit before this method returns.
 *
 * The issuing DB role has INSERT-only table permission. No raw challenge
 * is persisted, printed or returned to the general web application.
 */
export async function issueGaizMtlsChallengeCandidate(socket,{
  trustedPeers,issuerPool,tenantId,workItemId,nowMs,
  authorizeWorkerWorkItem,
}={}){
  if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')deny();
  if(!UUID.test(tenantId??'')||!UUID.test(workItemId??'')||
     !issuerPool||typeof issuerPool.transaction!=='function'||
     typeof authorizeWorkerWorkItem!=='function'||
     !Number.isSafeInteger(nowMs)||nowMs<=0)deny();

  // This authenticates the actual peer certificate and registry entry,
  // not a request-controlled identity flag.
  const peer=verifyGaizMtlsPeerCandidate(socket,{trustedPeers,nowMs});
  const entitlement=await authorizeWorkerWorkItem(Object.freeze({
    tenantId,workItemId,workerId:peer.workerId,role:peer.role,
    certificateSha256:peer.certificateSha256,
  }));
  if(entitlement!==true)deny();

  // Keep challenges valid <= 30s and never beyond the certificate/registry.
  const expiryMs=Math.min(nowMs+30000,peer.credentialExpiresAtMs);
  if(expiryMs-nowMs<1000)deny();
  const secret=randomBytes(32);
  const challengeSha256=createHash('sha256').update(secret).digest('hex');
  const challenge=secret.toString('base64url');
  secret.fill(0);
  try{
    // No raw challenge is sent if the issuer DB transaction fails.
    await issuerPool.transaction(async tx=>{
      if(!tx||typeof tx.execute!=='function')deny();
      const identity=rows(await tx.execute(sql`SELECT current_user AS "dbRole"`));
      if(identity.length!==1||identity[0].dbRole!==AUTH_ROLE)deny();
      // PostgreSQL enforces the issued challenge's expiry and digest length.
      // INSERT has no RETURNING: the issuer role has no SELECT privilege.
      const inserted=await tx.execute(sql`
        INSERT INTO gaiz_workload_challenges
          (challenge_sha256,tenant_id,worker_id,work_item_id,purpose,
           credential_issuer,expires_at)
        VALUES (decode(${challengeSha256},'hex'),${tenantId}::uuid,
          ${peer.workerId}::uuid,${workItemId}::uuid,${peer.role},
          ${peer.credentialIssuer},
          to_timestamp(${expiryMs}::double precision / 1000))
        ON CONFLICT (challenge_sha256) DO NOTHING
      `);
      // postgres.js (used by TEBE) reports affected rows as .count. Require
      // exactly one, never infer success from an empty result array.
      // Require the database driver's actual affected-row count; never
      // infer success from a resolved promise or an empty SELECT response.
      if(!inserted||inserted.count!==1)deny();
    });
    return Object.freeze({
      challenge,expiresAtMs:expiryMs,
      tenantId,workerId:peer.workerId,workItemId,
      purpose:peer.role,credentialIssuer:peer.credentialIssuer,
      challengeClaimRequired:true,assignmentClaimRequired:true,
      authorizationGranted:false,importAllowed:false,
    });
  }catch{deny()}
}
