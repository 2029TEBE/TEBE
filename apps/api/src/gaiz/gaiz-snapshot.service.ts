import { ConflictException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { portfolios, projects, withTenant } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';
import { fingerprintGaizTarget } from './gaiz-import-authorization.mjs';

/**
 * Internal-only authoritative snapshot reader for GAIZ conflict checks.
 * Exact field values remain in server memory. No API route returns them.
 * Requires migration 0023; production disabled until security acceptance.
 */
@Injectable()
export class GaizSnapshotService {
  private context() {
    if (process.env.NODE_ENV !== 'development' ||
      (process.env.DEPLOYMENT_ENV && process.env.DEPLOYMENT_ENV !== 'development') ||
      process.env.GAIZ_SNAPSHOT_PREVIEW_ENABLED !== 'true')
      throw new ConflictException('GAIZ snapshots are disabled');
    requireCapability('pmoa_manage_projects');
    const ctx = currentContext();
    if (!ctx.userId) throw new ConflictException('Authenticated user required');
    return { tenantId: ctx.tenantId, userId: ctx.userId };
  }

  async readInternal(kind: 'project' | 'portfolio', targetId: string) {
    const { tenantId } = this.context();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId))
      throw new ConflictException('Invalid target identifier');
    if (kind === 'project') {
      const [row] = await withTenant(tenantId, tx => tx.select({
        id: projects.id, tenantId: projects.tenantId, revision: projects.revision, name: projects.name,
      }).from(projects).where(and(eq(projects.id, targetId), eq(projects.tenantId, tenantId))).limit(1));
      if (!row) throw new ConflictException('Project unavailable for tenant');
      return this.snapshot({ kind, id:row.id, tenantId:row.tenantId, revision:row.revision, fields:{ name:row.name } });
    }
    if (kind === 'portfolio') {
      const [row] = await withTenant(tenantId, tx => tx.select({
        id: portfolios.id, tenantId: portfolios.tenantId,
        revision: portfolios.revision, description: portfolios.description,
      }).from(portfolios).where(and(eq(portfolios.id, targetId), eq(portfolios.tenantId, tenantId))).limit(1));
      if (!row) throw new ConflictException('Portfolio unavailable for tenant');
      return this.snapshot({ kind, id:row.id, tenantId:row.tenantId, revision:row.revision,
        fields:{ description:row.description } });
    }
    throw new ConflictException('Unsupported GAIZ target');
  }

  private snapshot(snapshot: {
    kind: 'project' | 'portfolio'; id: string; tenantId: string; revision: number;
    fields: Record<string, string | null>;
  }) {
    // Reject inconsistent DB snapshots before producing a fingerprint.
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0)
      throw new ConflictException('Invalid entity revision');
    const targetSnapshotSha256 = fingerprintGaizTarget(snapshot);
    return Object.freeze({ snapshot: Object.freeze({
      ...snapshot, fields: Object.freeze({...snapshot.fields}),
    }), targetSnapshotSha256, containsSensitiveFields: true });
  }

  /** Requery the latest committed values; refuse any concurrent update. */
  async checkUnchanged(kind:'project'|'portfolio',targetId:string,
    expectedRevision:number,expectedFingerprint:string) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
        !/^[a-f0-9]{64}$/.test(expectedFingerprint))
      throw new ConflictException('Invalid expected snapshot identity');
    const current = await this.readInternal(kind,targetId);
    if (current.snapshot.revision !== expectedRevision ||
        current.targetSnapshotSha256 !== expectedFingerprint)
      throw new ConflictException('GAIZ preview is stale; generate a new review');
    return Object.freeze({
      status:'snapshot-current-no-write',
      targetSnapshotSha256:current.targetSnapshotSha256,
      targetKind:kind,targetId,
      appliesData:false,importAllowed:false,
    });
  }
}
