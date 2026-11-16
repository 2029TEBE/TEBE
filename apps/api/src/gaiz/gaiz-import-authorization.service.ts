import { ConflictException, Injectable } from '@nestjs/common';
import { and, eq, gt, ne } from 'drizzle-orm';
import { withTenant, auditEvents, gaizImportRequests, gaizCustodyAttempts, gaizImportAuthorizations } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';
import { GaizSnapshotService } from './gaiz-snapshot.service';
import { GaizMappingRegistryService } from './gaiz-mapping-registry.service';
import { verifyMappingPreviewReceipt } from './gaiz-mapping-attestation.mjs';

/**
 * Draft second review ledger, NOT an import engine.
 * Requires migrations 0020-0022 validated on an isolated tenant DB.
 * No project/portfolio writes and no plaintext ever stored.
 */
@Injectable()
export class GaizImportAuthorizationService {
  constructor(private readonly snapshots: GaizSnapshotService,
    private readonly mappingRegistry: GaizMappingRegistryService) {}
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
    targetId: string; targetRevision: number; targetSnapshotSha256: string; previewSha256: string;
    mappingProfileId:string; artifactSha256:string; reportSha256:string;
  }, trusted?: { mappingAttestation:unknown; custodianPublicKey:unknown; custodianId:string; }) {
    const { tenantId, userId } = this.actor();
    const HASH = /^[a-f0-9]{64}$/;
    if (!HASH.test(input.targetSnapshotSha256) || !HASH.test(input.previewSha256) ||
      !Number.isSafeInteger(input.targetRevision) || input.targetRevision < 0 ||
      !['project','portfolio'].includes(input.targetKind))
      throw new ConflictException('Invalid preview identity');
    // Independent tenant-RLS database read; never trust an incoming snapshot
    // hash without matching the actual target row and database revision.
    // Still only reserves a metadata review: the preview hash itself is not a
    // trusted custody proof, and no import executor consumes this record.
    await this.snapshots.checkUnchanged(input.targetKind,input.targetId,
      input.targetRevision,input.targetSnapshotSha256);
    // Caller-supplied preview hashes are insufficient. A server-owned
    // trusted custodian signer and signed preview evidence are mandatory.
    // This is never a browser-supplied public key or signer directory.
    if(!trusted?.custodianPublicKey||!trusted.custodianId||!trusted.mappingAttestation)
      throw new ConflictException('Trusted mapping attestation provider unavailable');
    const profile=await this.mappingRegistry.getApprovedInternal(
      input.mappingProfileId,input.targetKind);
    if(profile.tenantId!==tenantId)throw new ConflictException('Untrusted profile');
    const receipt=verifyMappingPreviewReceipt(trusted.mappingAttestation,{
      trustedCustodianPublicKey:trusted.custodianPublicKey,
      custodianId:trusted.custodianId,
      tenantId,stagingReviewId:input.stagingReviewId,
      artifactSha256:input.artifactSha256,reportSha256:input.reportSha256,
      targetId:input.targetId,targetKind:input.targetKind,
      targetSnapshotSha256:input.targetSnapshotSha256,
      revision:input.targetRevision,mappingProfileId:input.mappingProfileId,
      previewSha256:input.previewSha256,
    });
    if(receipt.importAllowed!==false)throw new ConflictException('Import grant denied');
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
          review.sha256 !== input.artifactSha256 ||
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
