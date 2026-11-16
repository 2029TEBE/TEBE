import { ConflictException, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, ne } from 'drizzle-orm';
import { auditEvents, gaizImportRequests, withTenant } from '@pmo/db';
import { requireCapability } from '../common/require-capability';
import { currentContext } from '../tenancy/tenant-context';

/**
 * Deliberately metadata-only, fail-closed GAIZ request queue.
 * This service DOES NOT decrypt, render, store artifacts or apply imports.
 * Requires reviewed 0020 migration before enabled in local development.
 */
@Injectable()
export class GaizStagingService {
  private context() {
    if (process.env.NODE_ENV === 'production' || process.env.GAIZ_STAGING_ENABLED !== 'true') {
      throw new ConflictException('GAIZ staging is not available');
    }
    const ctx = currentContext();
    if (!ctx.userId) throw new ConflictException('Signed-in account required');
    return { tenantId: ctx.tenantId, userId: ctx.userId };
  }

  async stage(receipt: { verified: true; artifactId: string; issuerId: string; sha256: string; tenantScope: string }) {
    requireCapability('pmoa_manage_projects');
    const { tenantId, userId } = this.context();
    if (!receipt.verified || receipt.tenantScope !== tenantId || !/^[a-f0-9]{64}$/.test(receipt.sha256)) {
      throw new ConflictException('GAIZ signature and tenant validation required');
    }
    return withTenant(tenantId, async tx => {
      // Unique (tenant_id, sha256) provides durable deduplication under concurrent requests.
      const [inserted] = await tx.insert(gaizImportRequests).values({
        tenantId, artifactId: receipt.artifactId, issuerId: receipt.issuerId,
        sha256: receipt.sha256, requestedBy: userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }).onConflictDoNothing({ target: [gaizImportRequests.tenantId, gaizImportRequests.sha256] })
        .returning({ id: gaizImportRequests.id });
      const [request] = await tx.select({
        id: gaizImportRequests.id, status: gaizImportRequests.status,
        artifactId: gaizImportRequests.artifactId, sha256: gaizImportRequests.sha256,
        requestedAt: gaizImportRequests.requestedAt, expiresAt: gaizImportRequests.expiresAt,
      }).from(gaizImportRequests).where(and(
        eq(gaizImportRequests.tenantId, tenantId), eq(gaizImportRequests.sha256, receipt.sha256),
      )).limit(1);
      if (!request) throw new ConflictException('GAIZ staging unavailable');
      if (inserted) {
        await tx.insert(auditEvents).values({
          tenantId, actorId: userId, entity: 'gaiz_import_request', entityId: request.id,
          action: 'gaiz.stage.requested',
          diff: { sha256: receipt.sha256, artifactId: receipt.artifactId, issuerId: receipt.issuerId },
        });
      }
      return { ...request, newRequest: Boolean(inserted), importAllowed: false };
    });
  }

  async list() {
    requireCapability('pmoa_manage_projects');
    const { tenantId } = this.context();
    return withTenant(tenantId, tx => tx.select({
      id: gaizImportRequests.id, artifactId: gaizImportRequests.artifactId,
      sha256: gaizImportRequests.sha256, issuerId: gaizImportRequests.issuerId,
      status: gaizImportRequests.status, requestedAt: gaizImportRequests.requestedAt,
      expiresAt: gaizImportRequests.expiresAt, reviewedAt: gaizImportRequests.reviewedAt,
    }).from(gaizImportRequests).where(eq(gaizImportRequests.tenantId, tenantId))
      .orderBy(desc(gaizImportRequests.requestedAt)).limit(50));
  }

  async review(id: string, decision: 'approved'|'rejected', note?: string) {
    requireCapability('pmoa_admin');
    const { tenantId, userId } = this.context();
    return withTenant(tenantId, async tx => {
      // Conditional UPDATE is an atomic single-winner transition; requester
      // cannot approve their own request, even when they hold admin capability.
      const [updated] = await tx.update(gaizImportRequests).set({
        status: decision, reviewedBy: userId, reviewedAt: new Date(), reviewNote: note ?? null,
      }).where(and(
        eq(gaizImportRequests.id, id),
        eq(gaizImportRequests.tenantId, tenantId),
        eq(gaizImportRequests.status, 'pending'),
        ne(gaizImportRequests.requestedBy, userId),
        gt(gaizImportRequests.expiresAt, new Date()),
      )).returning({
        id: gaizImportRequests.id, status: gaizImportRequests.status,
        sha256: gaizImportRequests.sha256,
      });
      if (!updated) throw new ConflictException('Request missing, expired, reviewed or self-approval prohibited');
      await tx.insert(auditEvents).values({
        tenantId, actorId: userId, entity: 'gaiz_import_request', entityId: updated.id,
        action: decision === 'approved' ? 'gaiz.stage.approved' : 'gaiz.stage.rejected',
        diff: { sha256: updated.sha256, note: note ?? null },
      });
      return { ...updated, importAllowed: false, appliesData: false };
    });
  }
}
