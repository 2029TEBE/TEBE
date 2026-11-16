/**
 * DISCONNECTED GAIZ challenge + assignment claim transaction candidate.
 * This verifies two independent Ed25519 trust chains and consumes TWO
 * replay markers in ONE DB transaction before the caller's operation.
 *
 * A trusted ingress MUST additionally authenticate transport (mTLS/PoP),
 * create the server challenge using a CSPRNG, pre-issue its digest under a
 * separate DB role and ensure the caller cannot select issuer keys.
 * This module does none of those operations, registers no route or service,
 * and never grants GAIZ imports or recipient key release.
 */
import {sql} from 'drizzle-orm';
import {verifyGaizSignedWorkloadCredential} from './gaiz-signed-workload-credential.mjs';
import {bindGaizWorkerIdentity} from './gaiz-workload-binding.mjs';
import {claimGaizWorkloadChallengeInTransaction} from './gaiz-workload-challenge-claim.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny=()=>{throw Error('GAIZ transactional challenge/assignment denied')};
const purposes=new Set(['gaiz_verify_worker','gaiz_execute_worker']);

/**
 * Candidate one-transaction orchestration only. The operation callback MUST
 * re-lock and re-read immutable evidence plus human approval and must commit
 * or roll back under the same database transaction. Its result is NOT a
 * business import permission; no production caller is registered.
 *
 * claimAssignment is a dependency seam injected only by trusted worker
 * composition, NOT by HTTP. Database claim safety must be reviewed independently.
 */
export async function withGaizChallengeBoundWorkerCandidate({
  pool,issueChallengeProof,
  signedWorkloadCredential,trustedCredentialIssuerPublicKey,
  expectedCredentialIssuerId,expectedChallenge,expectedWorkerId,
  signedAssignment,trustedAssignmentIssuerPublicKey,
  tenantId,workItemId,purpose,nowMs,claimAssignment,operation,
}={}){
  if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')deny();
  if(!pool||typeof pool.transaction!=='function'||
     !issueChallengeProof||issueChallengeProof.transportAuthenticated!==true||
     issueChallengeProof.challengeIssuedByIngress!==true||
     !UUID.test(tenantId??'')||!UUID.test(workItemId??'')||
     !purposes.has(purpose)||typeof claimAssignment!=='function'||
     typeof operation!=='function')deny();
  // Both flags above are only annotations; they do NOT authenticate the
  // transport or prove issuance. This candidate must not be exposed to
  // untrusted input or enabled without a real ingress/DB trust boundary.
  const credential=verifyGaizSignedWorkloadCredential(signedWorkloadCredential,{
    trustedCredentialIssuerPublicKey,
    expectedIssuerId:expectedCredentialIssuerId,
    expectedWorkerId,expectedPurpose:purpose,expectedChallenge,nowMs,
  });
  const assignment=bindGaizWorkerIdentity(signedAssignment,{
    workload:{
      workerId:credential.workerId,role:credential.role,
      credentialIssuer:credential.credentialIssuer,
      credentialExpiresAtMs:credential.credentialExpiresAtMs,
    },
    tenantId,workItemId,purpose,trustedIssuerPublicKey:trustedAssignmentIssuerPublicKey,nowMs,
  });
  if(assignment.importAllowed!==false||assignment.databaseClaimRequired!==true)deny();
  return pool.transaction(async tx=>{
    await tx.execute(sql`SELECT set_config('app.tenant_id',${tenantId},true)`);
    const challengeClaim=await claimGaizWorkloadChallengeInTransaction(tx,{
      challenge:expectedChallenge,tenantId,workerId:credential.workerId,workItemId,
      purpose,credentialIssuer:credential.credentialIssuer,
      credentialExpiresAtMs:credential.credentialExpiresAtMs,nowMs,
    });
    if(challengeClaim.claimAcquired!==true||challengeClaim.importAllowed!==false)deny();
    const assignmentClaim=await claimAssignment(tx,assignment,{
      workerId:credential.workerId,purpose,
    });
    if(assignmentClaim?.claimAcquired!==true||
       assignmentClaim?.assignmentId!==assignment.assignmentId||
       assignmentClaim?.importAllowed!==false)deny();
    // Both claims and operation must rollback if a later operation throws.
    return operation(tx,Object.freeze({
      tenantId,workItemId,workerId:credential.workerId,purpose,
      assignmentId:assignment.assignmentId,
      workloadChallengeSha256:challengeClaim.challengeSha256,
      assignmentClaimAcquired:true,challengeClaimAcquired:true,
      importAllowed:false,
    }));
  });
}
