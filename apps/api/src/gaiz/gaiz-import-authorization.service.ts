import { ConflictException, Injectable } from '@nestjs/common';
import { and, eq, gt, ne } from 'drizzle-orm';
import { withTenant, auditEvents, gaizImportRequests, gaizCustodyAttempts, gaizImportAuthorizations } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';

/**
 * Draft second review ledger, NOT an import engine.
 * Requires migrations 0020-0022 validated on an isolated tenant DB.
 * No project/portfolio writes and no plaintext ever stored.
 */
@Injectable()
export class GaizImportAuthorizationService {
  private actor() {
    if (process.env.NODE_ENV !== 'development' ||
       (process.env.DEPLOYMENT_ENV && process.env.DEPLOYMENT_ENV !== 'development') ||
       process.env.GAIZ_IMPORT_REVIEW_ENABLED !== 'true')
      throw new ConflictException('GAIZ import review disabled');
    requireCapability('pmoa_admin');
    const ctx = currentContext();
    if (!ctx.userId) throw new ConflictException('Authenticated reviewer required');
    return { tenantId: ctx.tenantId, userId: ctx.userId };
  }

  async request(input: {
    stagingReviewId: string; custodyAttemptId: string; targetKind: 'project'|'portfolio';
    targetId: string; targetSnapshotSha256: string; previewSha256: string;
  }) {
    const { tenantId, userId } = this.actor();
    const HASH = /^[a-f0-9]{64}$/;
    if (!HASH.test(input.targetSnapshotSha256) || !HASH.test(input.previewSha256) ||
      !['project','portfolio'].includes(input.targetKind))
      throw new ConflictException('Invalid preview identity');
    // The supplied hashes are not trusted until an independently signed
    // custodian receipt and RLS target snapshot can be verified server-side.
    // Therefore this metadata reservation is intentionally NOT executable.
    return withTenant(tenantId, async tx => {
      const [review] = await tx.select({
        id: gaizImportRequests.id, status: gaizImportRequests.status,
        sha256: gaizImportRequests.sha256, expiresAt: gaizImportRequests.expiresAt,
      }).from(gaizImportRequests).where(and(
        eq(gaizImportRequests.tenantId, tenantId),
        eq(gaizImportRequests.id, input.stagingReviewId),
      )).limit(1);
      const [custody] = await tx.select({
        id: gaizCustodyAttempts.id, status: gaizCustodyAttempts.status,
        artifactSha256: gaizCustodyAttempts.artifactSha256,
        reviewId: gaizCustodyAttempts.reviewId,
      }).from(gaizCustodyAttempts).where(and(
        eq(gaizCustodyAttempts.tenantId, tenantId),
        eq(gaizCustodyAttempts.id, input.custodyAttemptId),
      )).limit(1);
      if (!review || review.status !== 'approved' || review.expiresAt <= new Date() ||
          !custody || custody.status !== 'validated' ||
          custody.reviewId !== review.id || custody.artifactSha256 !== review.sha256)
        throw new ConflictException('Review or custody evidence invalid');
      const [inserted] = await tx.insert(gaizImportAuthorizations).values({
        tenantId, stagingReviewId: review.id, custodyAttemptId: custody.id,
        targetId: input.targetId, targetKind: input.targetKind,
        targetSnapshotSha256: input.targetSnapshotSha256, previewSha256: input.previewSha256,
        requestedBy: userId, expiresAt: new Date(Date.now()+30*60*1000),
      }).onConflictDoNothing().returning({id:gaizImportAuthorizations.id});
      if (!inserted) throw new ConflictException('Import review already requested');
      await tx.insert(auditEvents).values({
        tenantId, actorId:userId,entity:'gaiz_import_authorization',entityId:inserted.id,
        action:'gaiz.import_review.requested',diff:{
          stagingReviewId:review.id,custodyAttemptId:custody.id,
          targetKind:input.targetKind,targetId:input.targetId,
          previewSha256:input.previewSha256,
        },
      });
      return {id:inserted.id, status:'pending', approvedForWrite:false,
        requiresAuthoritativePreviewVerification:true, importAllowed:false};
    });
  }

  async decide(id:string, decision:'approved'|'rejected') {
    const { tenantId, userId } = this.actor();
    if (!['approved','rejected'].includes(decision))
      throw new ConflictException('Unsupported decision');
    return withTenant(tenantId,async tx=>{
      const [record] = await tx.select({
        stagingReviewId: gaizImportAuthorizations.stagingReviewId,
      }).from(gaizImportAuthorizations).where(and(
        eq(gaizImportAuthorizations.tenantId,tenantId),
        eq(gaizImportAuthorizations.id,id),
      )).limit(1);
      if (!record) throw new ConflictException('Import review unavailable');
      const [origin] = await tx.select({
        requestedBy:gaizImportRequests.requestedBy,
        status:gaizImportRequests.status,
        expiresAt:gaizImportRequests.expiresAt,
      }).from(gaizImportRequests).where(and(
        eq(gaizImportRequests.id,record.stagingReviewId),
        eq(gaizImportRequests.tenantId,tenantId),
      )).limit(1);
      if (!origin || origin.requestedBy===userId || origin.status!=='approved' ||
          origin.expiresAt<=new Date()) {
        throw new ConflictException('Original stage requester cannot authorize import');
      }
      const [updated]=await tx.update(gaizImportAuthorizations).set({
        status:decision,approvedBy:userId,reviewedAt:new Date(),
      }).where(and(
        eq(gaizImportAuthorizations.tenantId,tenantId),
        eq(gaizImportAuthorizations.id,id),
        eq(gaizImportAuthorizations.status,'pending'),
        ne(gaizImportAuthorizations.requestedBy,userId),
        gt(gaizImportAuthorizations.expiresAt,new Date()),
      )).returning({id:gaizImportAuthorizations.id,previewSha256:gaizImportAuthorizations.previewSha256});
      if(!updated)throw new ConflictException('Decision expired, repeated or self-approved');
      await tx.insert(auditEvents).values({
        tenantId,actorId:userId,entity:'gaiz_import_authorization',entityId:updated.id,
        action:decision==='approved'?'gaiz.import_review.approved':'gaiz.import_review.rejected',
        diff:{previewSha256:updated.previewSha256},
      });
      // No write-capable endpoint consumes approvals. A further independent
      // signed preview & current target fingerprint must be verified.
      return {id:updated.id,status:decision,approvedForWrite:false,
        importAllowed:false,appliesData:false};
    });
  }
}
