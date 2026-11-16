export interface GaizTargetSnapshot {
  kind: 'project' | 'portfolio';
  id: string;
  tenantId: string;
  revision: number;
  fields: Record<string, string | null>;
}
export declare function fingerprintGaizTarget(snapshot: GaizTargetSnapshot): string;
export declare function validateGaizImportAuthorization(input: unknown): Readonly<{
  status: 'second-review-validated-no-write';
  tenantId: string; stagingReviewId: string; custodyAttemptId: string;
  previewSha256: string; targetSnapshotSha256: string;
  proposedOperations: readonly [];
  appliesData: false; importAllowed: false;
  requiresFreshCustody: true; requiresWriteTransactionReview: true;
}>;
