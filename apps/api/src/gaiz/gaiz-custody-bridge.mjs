// Authenticated GAIZ2 custody handoff contract. No key material and no HTTP route.
// Production trust records MUST come from server-owned, tenant-scoped sources.
// This accepts interfaces, not arbitrary browser JSON or a caller-supplied receipt.
import {evaluateTebeCustody} from './gaiz-custody-policy.mjs';
import {verifyCustodianAttestation} from './gaiz-custody-attestation.mjs';

const SHA=/^[a-f0-9]{64}$/;
const MAX_RECEIPT_AGE_MS=300000;
function assertPort(port){
 if(!port||typeof port.loadReview!=='function'||
    typeof port.loadRecipient!=='function'||typeof port.loadCustodianTrust!=='function'||
    typeof port.getVerifiedArtifact!=='function'||typeof port.requestAttestation!=='function'||
    typeof port.reserveAttempt!=='function'||typeof port.recordResult!=='function')
  throw Error('Explicit trusted custody port required');
 return port;
}
function checkContext(context){
 if(!context||typeof context.tenantId!=='string'||typeof context.userId!=='string'||
   !Array.isArray(context.capabilities)||!context.capabilities.includes('pmoa_admin'))
  throw Error('Authorized tenant context required');
}
/** Reserve/replay and audit callbacks must be transactional and durable.
 * A single-use attempt is burned before any external custodial operation.
 * A completed attempt MUST be rejected if replayed, irrespective of status.
 * The port is trusted server infrastructure; this module does not prove the
 * trustworthiness of its implementation. */
export async function requestGaizCustodyValidation({
 context,reviewId,artifactSha256,recipientKeyId,now=Date.now(),
},{port}={}){
 checkContext(context);
 if(typeof reviewId!=='string'||typeof recipientKeyId!=='string'||
    typeof artifactSha256!=='string'||!SHA.test(artifactSha256)||
    !Number.isSafeInteger(now))throw Error('Invalid custody request identity');
 const p=assertPort(port);
 const query=Object.freeze({tenantId:context.tenantId,reviewId,artifactSha256,recipientKeyId});
 // All readers independently enforce tenant RLS and deny revoked records.
 const [review,recipient,verification,trust]=await Promise.all([
   p.loadReview(query),p.loadRecipient(query),p.getVerifiedArtifact(query),p.loadCustodianTrust(query),
 ]);
 if(!review||review.id!==reviewId||review.sha256!==artifactSha256||
    !recipient||recipient.keyId!==recipientKeyId||
    !verification||!trust||trust.status!=='active'||trust.tenantId!==context.tenantId||
    !trust.publicKey||typeof trust.custodianId!=='string')
   throw Error('Trusted tenant records unavailable');
 // Date is compared under the trusted server clock and never passed from HTTP.
 const decision=evaluateTebeCustody({context,request:review,verification,
   recipient,consent:recipient.consent,now});
 if(decision.keyId!==recipientKeyId||decision.sha256!==artifactSha256)
   throw Error('Custody decision mismatch');
 const claim=Object.freeze({
   tenantId:decision.tenantId,reviewId:decision.reviewId,
   artifactSha256:decision.sha256,recipientKeyId:decision.keyId,
   actorId:decision.actorId,operation:'validate-only-no-import',
   custodianId:trust.custodianId,
 });
 // Reserve first, fail closed if unavailable or already used.
 const reservation=await p.reserveAttempt(claim);
 if(!reservation||reservation.reserved!==true||
    typeof reservation.attemptId!=='string'||reservation.attemptId.length<8)
   throw Error('Custody attempt unavailable or replayed');
 // The port must authenticate the remote custodian and never transfer
 // private keys or plaintext over this interface.
 let validated;
 try {
   const attestation=await p.requestAttestation(Object.freeze({...claim,
     attemptId:reservation.attemptId}));
   validated=verifyCustodianAttestation(attestation,{
     trustedCustodianPublicKey:trust.publicKey,tenantId:context.tenantId,
     expectedArtifactSha256:artifactSha256,expectedReviewId:reviewId,
     now,
   });
   if(attestation.payload.keyId!==recipientKeyId||
      attestation.payload.artifactId!==review.artifactId||
      attestation.payload.validation!=='schema-validated-no-import')
     throw Error('Custodian identity/validation mismatch');
   await p.recordResult(Object.freeze({attemptId:reservation.attemptId,
     tenantId:context.tenantId,reviewId,artifactSha256,
     status:'validated',reportSha256:validated.reportSha256}));
 } catch {
   // Record a non-secret failure, but never release the reservation.
   try{await p.recordResult(Object.freeze({attemptId:reservation.attemptId,
     tenantId:context.tenantId,reviewId,artifactSha256,status:'denied'}));}catch{}
   throw Error('Custody validation refused');
 }
 return Object.freeze({status:'attestation-validated-no-import',
   attemptId:reservation.attemptId,artifactSha256,
   reportSha256:validated.reportSha256,
   tenantId:context.tenantId,reviewId,
   importAllowed:false,decryptAllowed:false,plaintextReleased:false,
 });
}
// There is deliberately no environment fallback, HTTP route, or default port.
