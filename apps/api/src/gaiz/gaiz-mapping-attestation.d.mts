import type { KeyObject } from 'node:crypto';
export interface GaizMappingAttestation {
 payload:Record<string,unknown>;
 signature:string;
}
export declare function verifyMappingPreviewReceipt(
 attestation:unknown,
 expectations:{
  trustedCustodianPublicKey:KeyObject|string|Buffer|unknown;
  tenantId:string;stagingReviewId:string;artifactSha256:string;reportSha256:string;
  targetId:string;targetKind:'project'|'portfolio';targetSnapshotSha256:string;
  revision:number;mappingProfileId:string;previewSha256:string;custodianId:string;now?:number;
 }
):Readonly<{
 status:'verified-mapping-metadata-only';tenantId:string;targetId:string;
 revision:number;previewSha256:string;importAllowed:false;appliesData:false;containsPlaintext:false;
}>;
