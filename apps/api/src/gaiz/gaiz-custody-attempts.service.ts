import { ConflictException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { auditEvents, gaizImportRequests, gaizCustodyAttempts, withTenant } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';

/** Trusted server-side RLS adapter. No private key, ciphertext or plaintext. */
@Injectable()
export class GaizCustodyAttemptsService {
  private actor() {
    if (process.env.NODE_ENV !== 'development' ||
        (process.env.DEPLOYMENT_ENV && process.env.DEPLOYMENT_ENV !== 'development') ||
        process.env.GAIZ_CUSTODY_BRIDGE_ENABLED !== 'true') {
      throw new ConflictException('GAIZ custody bridge is disabled');
    }
    requireCapability('pmoa_admin');
    const ctx=currentContext();
    if (!ctx.userId) throw new ConflictException('Authenticated custodian operator required');
    return {tenantId:ctx.tenantId,actorId:ctx.userId};
  }

  async loadReview(query: {tenantId:string;reviewId:string;artifactSha256:string}) {
    const ctx=this.actor();
    if(query.tenantId!==ctx.tenantId) throw new ConflictException('Tenant mismatch');
    const [review]=await withTenant(ctx.tenantId,tx=>tx.select({
      id:gaizImportRequests.id,tenantId:gaizImportRequests.tenantId,
      sha256:gaizImportRequests.sha256,artifactId:gaizImportRequests.artifactId,
      issuerId:gaizImportRequests.issuerId,requestedBy:gaizImportRequests.requestedBy,
      reviewedBy:gaizImportRequests.reviewedBy,status:gaizImportRequests.status,
      expiresAt:gaizImportRequests.expiresAt,
    }).from(gaizImportRequests).where(and(
      eq(gaizImportRequests.tenantId,ctx.tenantId),
      eq(gaizImportRequests.id,query.reviewId),
      eq(gaizImportRequests.sha256,query.artifactSha256),
    )).limit(1));
    return review ? {...review,expiresAt:review.expiresAt.toISOString()} : null;
  }

  async reserveAttempt(claim: {
    tenantId:string;reviewId:string;artifactSha256:string;recipientKeyId:string;actorId:string;
  }) {
    const ctx=this.actor();
    if(claim.tenantId!==ctx.tenantId||claim.actorId!==ctx.actorId)throw new ConflictException('Actor mismatch');
    return withTenant(ctx.tenantId,async tx=>{
      const [review]=await tx.select({
        id:gaizImportRequests.id,status:gaizImportRequests.status,
        sha256:gaizImportRequests.sha256,expiresAt:gaizImportRequests.expiresAt,
      }).from(gaizImportRequests).where(and(
        eq(gaizImportRequests.tenantId,ctx.tenantId),
        eq(gaizImportRequests.id,claim.reviewId),
        eq(gaizImportRequests.sha256,claim.artifactSha256),
      )).limit(1);
      if(!review||review.status!=='approved'||review.expiresAt.getTime()<=Date.now())
        throw new ConflictException('Review expired or not approved');
      const [created]=await tx.insert(gaizCustodyAttempts).values({
        tenantId:ctx.tenantId,reviewId:claim.reviewId,
        artifactSha256:claim.artifactSha256,recipientKeyId:claim.recipientKeyId,
        requestedBy:ctx.actorId,
      }).onConflictDoNothing().returning({id:gaizCustodyAttempts.id});
      if(!created) return {reserved:false};
      await tx.insert(auditEvents).values({
        tenantId:ctx.tenantId,actorId:ctx.actorId,
        entity:'gaiz_custody_attempt',entityId:created.id,
        action:'gaiz.custody.reserved',
        diff:{reviewId:claim.reviewId,artifactSha256:claim.artifactSha256,
          recipientKeyId:claim.recipientKeyId},
      });
      return {reserved:true,attemptId:created.id};
    });
  }

  async recordResult(result: {
    tenantId:string;attemptId:string;reviewId:string;artifactSha256:string;
    status:'validated'|'denied';reportSha256?:string;
  }) {
    const ctx=this.actor();
    if(result.tenantId!==ctx.tenantId ||
        !['validated','denied'].includes(result.status) ||
        (result.status==='validated' && !/^[a-f0-9]{64}$/.test(result.reportSha256??'')))
      throw new ConflictException('Invalid custody result');
    return withTenant(ctx.tenantId,async tx=>{
      const [updated]=await tx.update(gaizCustodyAttempts).set({
        status:result.status,
        reportSha256:result.status==='validated'?result.reportSha256:null,
        completedAt:new Date(),
      }).where(and(
        eq(gaizCustodyAttempts.tenantId,ctx.tenantId),
        eq(gaizCustodyAttempts.id,result.attemptId),
        eq(gaizCustodyAttempts.reviewId,result.reviewId),
        eq(gaizCustodyAttempts.artifactSha256,result.artifactSha256),
        eq(gaizCustodyAttempts.requestedBy,ctx.actorId),
        eq(gaizCustodyAttempts.status,'reserved'),
      )).returning({id:gaizCustodyAttempts.id});
      if(!updated)throw new ConflictException('Custody attempt is already final or unavailable');
      await tx.insert(auditEvents).values({
        tenantId:ctx.tenantId,actorId:ctx.actorId,
        entity:'gaiz_custody_attempt',entityId:updated.id,
        action:result.status==='validated'?'gaiz.custody.validated':'gaiz.custody.denied',
        diff:{reviewId:result.reviewId,artifactSha256:result.artifactSha256,
          reportSha256:result.status==='validated'?result.reportSha256:null},
      });
      return {recorded:true,importAllowed:false};
    });
  }
}
