// Preview-only import readiness plan. No database calls, plaintext, or mutation.
// Call only with authenticated context, RLS-fetched review and independently
// verified custodian attestation, never untrusted request body records.
import {verifyCustodianAttestation} from './gaiz-custody-attestation.mjs';

const HASH=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function buildReadOnlyGaizImportPlan({
  context,review,verifiedArtifact,custodianAttestation,trustedCustodianPublicKey,
  project,now=Date.now(),
}={}){
 if(!context?.userId||!UUID.test(context.tenantId)||!context.capabilities?.includes('pmoa_manage_projects'))
   throw Error('Authenticated tenant import-planning permission required');
 if(!review||review.tenantId!==context.tenantId||review.status!=='approved'||
    !UUID.test(review.id)||!UUID.test(review.requestedBy)||!UUID.test(review.reviewedBy)||
    review.requestedBy===review.reviewedBy||
    !HASH.test(review.sha256)||typeof review.expiresAt!=='string'||
    !Number.isFinite(Date.parse(review.expiresAt))||Date.parse(review.expiresAt)<=now)
   throw Error('Approved, current, distinct-person review required');
 if(!verifiedArtifact||verifiedArtifact.verified!==true||
    verifiedArtifact.tenantScope!==context.tenantId||verifiedArtifact.sha256!==review.sha256||
    verifiedArtifact.artifactId!==review.artifactId||
    verifiedArtifact.issuerId!==review.issuerId)
   throw Error('Artifact identity mismatch');
 if(!project||project.tenantId!==context.tenantId||!UUID.test(project.id)||
    project.status==='deleted')throw Error('Authorized project selection required');
 // Independent signing key must come from an authenticated trust directory.
 const attested=verifyCustodianAttestation(custodianAttestation,{
   trustedCustodianPublicKey,tenantId:context.tenantId,
   expectedArtifactSha256:review.sha256,expectedReviewId:review.id,now,
 });
 if(attested.importAllowed!==false)throw Error('Unexpected custodian authority');
 return Object.freeze({
   status:'evidence-only-readiness-preview',tenantId:context.tenantId,
   projectId:project.id,reviewId:review.id,artifactSha256:review.sha256,
   reportSha256:attested.reportSha256,
   proposedOperations:Object.freeze([]),proposedRecords:0,
   requiresSeparateBusinessDataMapping:true,
   requiresExplicitSecondImportApproval:true,
   requiresFreshCustodianAttestation:true,
   appliesData:false,importAllowed:false,plaintextReleased:false,
 });
}
