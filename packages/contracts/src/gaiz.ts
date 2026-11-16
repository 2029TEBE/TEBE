import { z } from 'zod';

/**
 * Candidate GAIZ v1 API types. These describe TEBE-owned workflow metadata,
 * NOT a canonical TO cryptographic wire-format specification.
 */
export const gaizArtifactId = z.string().trim().min(1).max(256);
export const gaizJobId = z.string().uuid();
export const gaizCorrelationId = z.string().uuid();
export const gaizImportState = z.enum([
  'quarantined', 'verified', 'pending_approval', 'approved', 'rejected',
  'importing', 'imported', 'failed',
]);
export const gaizExportFormat = z.enum(['pdf', 'html', 'gaiz']);
export const gaizExportState = z.enum(['pending', 'packaging', 'ready', 'failed']);
export const gaizVerificationOutcome = z.enum([
  'pending', 'verified', 'invalid', 'unsupported', 'untrusted', 'tenant_mismatch',
]);
export const gaizImportSubmission = z.object({
  artifactReference: z.string().trim().min(1).max(2048),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  targetWorkspaceId: z.string().uuid(),
}).strict();
export const gaizDecision = z.object({
  expectedRevision: z.number().int().nonnegative(),
  comment: z.string().trim().max(2000).optional(),
}).strict();
export const gaizExportSubmission = z.object({
  format: gaizExportFormat,
  reportId: z.string().uuid(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  locale: z.enum(['en', 'ar']).default('en'),
}).strict();
export const gaizJobReceipt = z.object({
  id: gaizJobId,
  tenantId: z.string().uuid(),
  artifactId: gaizArtifactId,
  state: gaizImportState,
  revision: z.number().int().nonnegative(),
  correlationId: gaizCorrelationId,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

export type GaizImportSubmission = z.infer<typeof gaizImportSubmission>;
export type GaizExportSubmission = z.infer<typeof gaizExportSubmission>;
export type GaizDecision = z.infer<typeof gaizDecision>;
export type GaizJobReceipt = z.infer<typeof gaizJobReceipt>;
