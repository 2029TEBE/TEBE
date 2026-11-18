export interface GaizCustodyContext {
 tenantId:string;userId:string;capabilities:string[];
}
export interface GaizCustodyQuery {
 tenantId:string;reviewId:string;artifactSha256:string;recipientKeyId:string;
}
export interface GaizCustodyClaim extends GaizCustodyQuery {
 actorId:string;operation:string;custodianId:string;attemptId?:string;
}
export interface GaizCustodyResult {
 tenantId:string;reviewId:string;artifactSha256:string;
 attemptId:string;status:'validated'|'denied';reportSha256?:string;
}
export interface GaizCustodyPort {
 loadReview(q:GaizCustodyQuery):Promise<unknown>;
 loadRecipient(q:GaizCustodyQuery):Promise<unknown>;
 loadCustodianTrust(q:GaizCustodyQuery):Promise<unknown>;
 getVerifiedArtifact(q:GaizCustodyQuery):Promise<unknown>;
 requestAttestation(c:GaizCustodyClaim):Promise<unknown>;
 reserveAttempt(c:GaizCustodyClaim):Promise<{reserved:boolean;attemptId?:string}>;
 recordResult(r:GaizCustodyResult):Promise<unknown>;
}
export declare function requestGaizCustodyValidation(
 input:{context:GaizCustodyContext;reviewId:string;artifactSha256:string;recipientKeyId:string;now?:number},
 options:{port:GaizCustodyPort},
):Promise<Readonly<{
 status:'attestation-validated-no-import';tenantId:string;reviewId:string;
 attemptId:string;artifactSha256:string;reportSha256:string;
 importAllowed:false;decryptAllowed:false;plaintextReleased:false;
}>>;
