import { ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type WorkerPurpose = 'gaiz_verify_worker' | 'gaiz_execute_worker';
type VerifiedAssignment = Readonly<{
  assignmentId: string; workerId: string; tenantId: string; workItemId: string;
  purpose: WorkerPurpose; expiresAtMs: number; authenticatedAssignment: true;
  databaseClaimRequired: true; importAllowed: false;
}>;
type TransportIdentity = Readonly<{ workerId: string; purpose: WorkerPurpose }>;
type ScopedTransaction = { execute: (statement: unknown) => Promise<unknown> };
const getRows = (result: unknown): Record<string, unknown>[] =>
  Array.isArray(result) ? result as Record<string, unknown>[] : [];
const purposes = new Set<WorkerPurpose>(['gaiz_verify_worker', 'gaiz_execute_worker']);

/**
 * DISCONNECTED prototype. Must be called by a future independently
 * authenticated worker inside ONE already-open tenant-scoped transaction,
 * immediately followed by its verification/import effect before COMMIT.
 *
 * Never commit this claim by itself. The same transaction must lock the work
 * item, check persisted evidence and perform audit/state/receipt changes.
 *
 * The transport identity MUST come from a verified workload credential (e.g.
 * mTLS) and the assignment MUST first be checked with
 * verifyGaizWorkerAssignment using a backend-owned issuer public key.
 * A caller-supplied JSON object is NOT proof of either requirement.
 *
 * This code does not establish that trusted caller boundary and is NOT wired
 * to any module, route, worker process or production database.
 */
export async function claimGaizWorkerAssignmentInTransaction(
  tx: ScopedTransaction,
  assignment: VerifiedAssignment,
  transport: TransportIdentity,
): Promise<Readonly<{ assignmentId: string; claimAcquired: true; importAllowed: false }>> {
  if (process.env.NODE_ENV === 'production' ||
      process.env.GAIZ_DEV_ONLY !== 'true') {
    throw new ServiceUnavailableException('GAIZ worker claims are not enabled');
  }
  if (!tx || typeof tx.execute !== 'function' ||
      !assignment || !transport ||
      !UUID.test(assignment.assignmentId) || !UUID.test(assignment.workerId) ||
      !UUID.test(assignment.tenantId) || !UUID.test(assignment.workItemId) ||
      !purposes.has(assignment.purpose) ||
      assignment.authenticatedAssignment !== true ||
      assignment.databaseClaimRequired !== true ||
      assignment.importAllowed !== false ||
      transport.workerId !== assignment.workerId ||
      transport.purpose !== assignment.purpose ||
      !Number.isSafeInteger(assignment.expiresAtMs) || assignment.expiresAtMs <= 0) {
    throw new ForbiddenException('Untrusted GAIZ worker assignment');
  }

  // The database credential is a second, independent identity boundary.
  // An interactive API role must never be able to claim worker assignments.
  const [identity] = getRows(await tx.execute(sql`
    SELECT current_user AS "dbRole",
           current_setting('app.tenant_id', true) AS "currentTenant"
  `));
  if (!identity || identity.dbRole !== assignment.purpose ||
      identity.currentTenant !== assignment.tenantId) {
    throw new ForbiddenException('GAIZ worker database identity mismatch');
  }

  // UNIQUE(assignment_id) is the replay lock. ON CONFLICT never returns a
  // successful claim on replay, including when tenant/purpose differ.
  // clock_timestamp() and expiry are checked by PostgreSQL, not caller time.
  const inserted = getRows(await tx.execute(sql`
    INSERT INTO gaiz_worker_assignment_claims
      (assignment_id, tenant_id, worker_id, work_item_id, purpose, expires_at)
    SELECT ${assignment.assignmentId}, ${assignment.tenantId},
           ${assignment.workerId}, ${assignment.workItemId},
           ${assignment.purpose}, to_timestamp(${assignment.expiresAtMs}::double precision / 1000)
    WHERE clock_timestamp() < to_timestamp(${assignment.expiresAtMs}::double precision / 1000)
    ON CONFLICT (assignment_id) DO NOTHING
    RETURNING assignment_id AS "assignmentId"
  `));
  if (inserted.length !== 1 ||
      inserted[0].assignmentId !== assignment.assignmentId) {
    throw new ConflictException('GAIZ assignment expired or already consumed');
  }
  return Object.freeze({
    assignmentId: assignment.assignmentId,
    claimAcquired: true as const,
    importAllowed: false as const,
  });
}
