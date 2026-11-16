import { Injectable, ServiceUnavailableException, ForbiddenException } from '@nestjs/common';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';
import type { GaizDecision, GaizExportSubmission, GaizImportSubmission } from '@pmo/contracts';

/**
 * Integration seam ONLY. No NestJS module registration or route activation
 * until reviewed persistence, issuer trust, DEK custody, and test fixtures exist.
 * Adapter dependencies are intentionally mandatory rather than silently using
 * memory or a different tenant's database.
 */
export interface GaizEnterpriseAdapter {
  submitImport(input: GaizImportSubmission, tenantId: string, actorId: string): Promise<unknown>;
  readImport(id: string, tenantId: string): Promise<unknown>;
  decideImport(id: string, decision: 'approve' | 'reject', input: GaizDecision,
    tenantId: string, actorId: string): Promise<unknown>;
  submitExport(input: GaizExportSubmission, tenantId: string, actorId: string): Promise<unknown>;
  readExport(id: string, tenantId: string): Promise<unknown>;
}

@Injectable()
export class GaizOrchestrator {
  // The integration must be explicitly injected with a reviewed, transactional
  // persistence adapter. This class is not registered in AppModule.
  constructor(private readonly adapter?: GaizEnterpriseAdapter) {}

  private allow(required: 'read' | 'pmoa_manage_projects' | 'pmoa_approve' | 'pmoa_view_financials') {
    // Hard disable in prod regardless of environment flag until security review.
    if (process.env.NODE_ENV === 'production' ||
        process.env.GAIZ_DEV_ONLY !== 'true' || !this.adapter)
      throw new ServiceUnavailableException('GAIZ integration is not enabled');
    const ctx = currentContext();
    if (!ctx.userId) throw new ForbiddenException('An authenticated enterprise user is required');
    requireCapability(required);
    return { tenantId: ctx.tenantId, userId: ctx.userId };
  }

  async submitImport(input: GaizImportSubmission) {
    const { tenantId, userId } = this.allow('pmoa_manage_projects');
    if (input.targetWorkspaceId !== tenantId)
      throw new ForbiddenException('Cannot import into another tenant');
    return this.adapter!.submitImport(input, tenantId, userId);
  }

  async readImport(id: string) {
    const { tenantId } = this.allow('read');
    return this.adapter!.readImport(id, tenantId);
  }

  async decideImport(id: string, decision: 'approve' | 'reject', input: GaizDecision) {
    const { tenantId, userId } = this.allow('pmoa_approve');
    return this.adapter!.decideImport(id, decision, input, tenantId, userId);
  }

  async submitExport(input: GaizExportSubmission) {
    const { tenantId, userId } = this.allow('pmoa_view_financials');
    if (input.format === 'gaiz')
      throw new ServiceUnavailableException('GAIZ packaging has not passed TO interoperability review');
    // Existing PDF/HTML interfaces must be connected by an approved adapter.
    return this.adapter!.submitExport(input, tenantId, userId);
  }

  async readExport(id: string) {
    const { tenantId } = this.allow('pmoa_view_financials');
    return this.adapter!.readExport(id, tenantId);
  }
}
