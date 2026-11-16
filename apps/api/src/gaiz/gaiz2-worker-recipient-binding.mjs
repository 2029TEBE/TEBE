/**
 * DEVELOPMENT-ONLY, unregistered GAIZ2 signed-workload-to-recipient binding.
 *
 * Both signatures are verified independently: worker assignment by the
 * backend-owned assignment issuer and envelope by the backend-owned GAIZ2
 * issuer. The selected wrapped key remains ciphertext. This function makes
 * NO KMS call and grants NO decryption or import authority.
 *
 * IMPORTANT: workload is an assertion made by the caller, NOT mTLS evidence.
 * Only an independently attested, trusted ingress may build this object.
 * The database claim must be consumed transactionally by a separate worker.
 */
import { bindGaizWorkerIdentity } from './gaiz-workload-binding.mjs';
import { verifyGaiz2RecipientForCustody } from './gaiz2-verifier.mjs';

const deny=()=>{throw new Error('GAIZ2 trusted recipient assignment denied')};
const validUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).sort().join(',')===keys.slice().sort().join(',');

/** Candidate verifier-worker request; call only in an isolated worker. */
export function bindGaiz2RecipientWorkerCandidate(bytes,{
  signedAssignment,trustedAssignmentIssuerPublicKey,
  trustedGaizIssuerPublicKey,
  expectedIssuerId,expectedTenantScope,recipientKeyId,
  tenantId,workItemId,workload,nowMs,
}={}){
  if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')deny();
  // Fail closed until the protocol defines a separately signed tenantScope
  // registry. The draft only permits the EXACT UUID tenant ID as envelope scope.
  if(!validUuid(tenantId)||!validUuid(workItemId)||
      expectedTenantScope!==tenantId||
      !exact(workload,['workerId','role','credentialIssuer','credentialExpiresAtMs'])||
      workload.role!=='gaiz_verify_worker')deny();
  const assignment=bindGaizWorkerIdentity(signedAssignment,{
    workload,tenantId,workItemId,purpose:'gaiz_verify_worker',
    trustedIssuerPublicKey:trustedAssignmentIssuerPublicKey,nowMs,
  });
  if(assignment.importAllowed!==false||assignment.databaseClaimRequired!==true)deny();
  const signed=verifyGaiz2RecipientForCustody(bytes,{
    trustedIssuerPublicKey:trustedGaizIssuerPublicKey,
    expectedIssuerId,expectedTenantScope,recipientKeyId,
  });
  if(signed.tenantScope!==assignment.tenantId||
     signed.authorizationGranted!==false||signed.importAllowed!==false)deny();
  // This is inert evidence, NOT a broker-authorized key release.
  // Never return arbitrary report JSON, DEK, issuer private keys or mTLS claims.
  return Object.freeze({
    format:'GAIZ2',
    assignmentId:assignment.assignmentId,
    workerId:assignment.workerId,
    workItemId:assignment.workItemId,
    tenantId:assignment.tenantId,
    artifactId:signed.artifactId,
    issuerId:signed.issuerId,
    envelopeSha256:signed.envelopeSha256,
    recipientKeyId,
    wrappedKey:signed.wrappedKey,
    algorithm:'RSA-OAEP-SHA256',
    purpose:'verify-metadata-only',
    credentialIssuer:assignment.workloadCredentialIssuer,
    assignmentExpiresAtMs:assignment.expiresAtMs,
    credentialExpiresAtMs:assignment.workloadCredentialExpiresAtMs,
    databaseClaimRequired:true,
    custodyAuthorizationRequired:true,
    authorizationGranted:false,
    importAllowed:false,
  });
}
