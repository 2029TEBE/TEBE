import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { auditEvents, withTenant } from '@pmo/db';
import type { GaizDecision, GaizExportSubmission, GaizImportSubmission } from '@pmo/contracts';
import type { GaizEnterpriseAdapter } from './gaiz-orchestrator';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';

const rows = (value: unknown) => value as unknown as any[];

/**
 * UNREGISTERED experimental persistence adapter.
 *
 * Requires reviewed GAIZ tables, tenant RLS and transaction tests before use.
 * This adapter deliberately does NOT process remote references, accept files,
 * release DEKs, start imports or deliver exports. It can read metadata and
 * persist a pre-validated human decision transactionally in a disposable DB.
 */
@Injectable()
export class GaizPostgresAdapter implements GaizEnterpriseAdapter {
  async submitImport(_input: GaizImportSubmission, _tenantId: string, _actorId: string): Promise<never> {
    throw new ServiceUnavailableException('Quarantine and artifact verification are not active');
  }

  async readImport(id: string, tenantId: string) {
    return withTenant(tenantId, async (tx) => {
      const [row] = rows(await tx.execute(sql`
        SELECT id, tenant_id AS "tenantId", artifact_ref AS "artifactRef",
               state, revision, correlation_id AS "correlationId",
               requested_by AS "requestedBy", approved_by AS "approvedBy",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM gaiz_import_jobs WHERE id = ${id} AND tenant_id = ${tenantId}
        LIMIT 1`));
      if (!row) throw new NotFoundException('GAIZ import not found');
      return row;
    });
  }

  async decideImport(
    id: string, decision: 'approve' | 'reject', input: GaizDecision,
    tenantId: string, actorId: string,
  ) {
    if (decision !== 'approve' && decision !== 'reject')
      throw new ConflictException('Unsupported GAIZ decision');
    // Defense in depth: check the authenticated server-derived context even
    // when a future caller bypasses the orchestrator and invokes this adapter.
    const ctx = currentContext();
    if (!ctx.userId || ctx.userId !== actorId || ctx.tenantId !== tenantId)
      throw new NotFoundException('GAIZ import not found');
    requireCapability('pmoa_approve');
    return withTenant(tenantId, async (tx) => {
      // Recheck membership under the same RLS-scoped transaction. The
      // orchestrator already checked session and capability.
      const [member] = rows(await tx.execute(sql`
        SELECT m.id FROM memberships m
        JOIN users u ON u.id = m.user_id
        WHERE m.tenant_id = ${tenantId} AND m.user_id = ${actorId}
          AND m.is_active = true AND u.is_active = true
        FOR SHARE OF m`));
      if (!member) throw new NotFoundException('Active tenant membership not found');

      const [job] = rows(await tx.execute(sql`
        SELECT j.id, j.state, j.revision,
               j.requested_by AS "requestedBy",
               j.mapping_validated_at AS "mappingValidatedAt",
               j.correlation_id AS "correlationId",
               a.verification_status AS "verificationStatus",
               a.content_integrity_verified_at AS "contentIntegrityVerifiedAt"
        FROM gaiz_import_jobs j
        JOIN gaiz_artifacts a ON a.id = j.artifact_ref AND a.tenant_id = j.tenant_id
        WHERE j.id = ${id} AND j.tenant_id = ${tenantId}
        FOR UPDATE OF j`));
      if (!job) throw new NotFoundException('GAIZ import not found');
      if (job.revision !== input.expectedRevision || job.state !== 'pending_approval')
        throw new ConflictException('GAIZ job changed or is no longer awaiting approval');

      if (decision === 'approve') {
        if (job.requestedBy === actorId)
          throw new ConflictException('Requester cannot self-approve an import');
        if (job.verificationStatus !== 'verified' ||
            !job.contentIntegrityVerifiedAt || !job.mappingValidatedAt)
          throw new ConflictException('Signature, content or mapping evidence is incomplete');
      }

      const nextState = decision === 'approve' ? 'approved' : 'rejected';
      const [updated] = rows(await tx.execute(sql`
        UPDATE gaiz_import_jobs
        SET state = ${nextState}, revision = revision + 1,
            approved_by = ${decision === 'approve' ? actorId : null},
            approval_decided_at = now(), updated_at = now()
        WHERE id = ${id} AND tenant_id = ${tenantId}
          AND revision = ${input.expectedRevision}
        RETURNING id, state, revision`));
      if (!updated) throw new ConflictException('Concurrent GAIZ decision rejected');

      await tx.execute(sql`
        INSERT INTO gaiz_decisions
          (id, tenant_id, import_id, actor_id, outcome, comment, correlation_id)
        VALUES (${randomUUID()}, ${tenantId}, ${id}, ${actorId},
                ${decision === 'approve' ? 'approved' : 'rejected'},
                ${input.comment ?? null}, ${job.correlationId})`);
      await tx.insert(auditEvents).values({
        tenantId, actorId, entity: 'gaiz_import_job', entityId: id,
        action: decision === 'approve' ? 'gaiz.approved' : 'gaiz.rejected',
        diff: { correlationId: job.correlationId, newState: nextState, revision: updated.revision },
      });
      return updated;
    });
  }

  async submitExport(_input: GaizExportSubmission, _tenantId: string, _actorId: string): Promise<never> {
    throw new ServiceUnavailableException('GAIZ export persistence and delivery are not active');
  }

  async readExport(id: string, tenantId: string) {
    return withTenant(tenantId, async (tx) => {
      const [row] = rows(await tx.execute(sql`
        SELECT id, tenant_id AS "tenantId", state, format,
               correlation_id AS "correlationId", created_at AS "createdAt"
        FROM gaiz_export_jobs WHERE id = ${id} AND tenant_id = ${tenantId}
        LIMIT 1`));
      if (!row) throw new NotFoundException('GAIZ export not found');
      return row;
    });
  }
}
