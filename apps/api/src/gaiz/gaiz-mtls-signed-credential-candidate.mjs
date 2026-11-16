/**
 * Inactive GAIZ authenticated TLS-peer + independently signed challenge
 * credential composition. No HTTP route, no DB claim, no KMS or import.
 *
 * MUST only be called from a TLS server's secureConnection callback. The
 * backend-controlled registry and credential issuer key must not originate
 * in a request, GAIZ envelope or untrusted worker process.
 */
import {verifyGaizMtlsPeerCandidate} from './gaiz-mtls-peer-candidate.mjs';
import {verifyGaizSignedWorkloadCredential} from './gaiz-signed-workload-credential.mjs';

const deny=()=>{throw Error('GAIZ mTLS/credential binding denied')};
export function bindGaizMtlsSignedCredentialCandidate(socket,{
  trustedPeers,nowMs,signedWorkloadCredential,
  trustedCredentialIssuerPublicKey,expectedCredentialIssuerId,
  expectedChallenge,
}={}){
  const peer=verifyGaizMtlsPeerCandidate(socket,{trustedPeers,nowMs});
  const credential=verifyGaizSignedWorkloadCredential(signedWorkloadCredential,{
    trustedCredentialIssuerPublicKey,
    expectedIssuerId:expectedCredentialIssuerId,
    expectedWorkerId:peer.workerId,
    expectedPurpose:peer.role,
    expectedChallenge,nowMs,
  });
  if(credential.workerId!==peer.workerId||credential.role!==peer.role||
     credential.credentialExpiresAtMs>peer.credentialExpiresAtMs||
     credential.atomicChallengeClaimRequired!==true||
     credential.importAllowed!==false)deny();
  return Object.freeze({
    workerId:peer.workerId,role:peer.role,
    credentialIssuer:credential.credentialIssuer,
    credentialExpiresAtMs:credential.credentialExpiresAtMs,
    peerCertificateSha256:peer.certificateSha256,
    // The challenge/assignment claims and recipient entitlement are
    // separate, mandatory steps in a dedicated worker DB transaction.
    authenticatedTransportEvidence:true,
    challengeClaimRequired:true,
    assignmentClaimRequired:true,
    custodyAuthorizationRequired:true,
    authorizationGranted:false,
    importAllowed:false,
  });
}
