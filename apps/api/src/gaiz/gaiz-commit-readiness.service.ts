import { ConflictException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  withTenant,projects,portfolios,gaizImportAuthorizations,
  gaizImportRequests,gaizCustodyAttempts,gaizMappingProfiles,
} from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';
import { fingerprintGaizTarget } from './gaiz-import-authorization.mjs';

/** Final pre-write inspection boundary. No SQL UPDATE/INSERT of enterprise
 * records, no plaintext and no import execution route.
 * Read locks make the observed snapshot consistent for this transaction,
 * but are RELEASED on return. A future real importer MUST recheck and
 * execute its CAS update in the SAME transaction, never reuse this receipt. */
@Injectable()
export class GaizCommitReadinessService {
  async inspectInternal(authorizationId:string) {
    if(process.env.NODE_ENV!=='development' ||
       (process.env.DEPLOYMENT_ENV && process.env.DEPLOYMENT_ENV!=='development') ||
       process.env.GAIZ_COMMIT_READINESS_ENABLED!=='true')
      throw new ConflictException('GAIZ commit readiness disabled');
    requireCapability('pmoa_admin');
    const ctx=currentContext();
    if(!ctx.userId||!/^[0-9a-f-]{36}$/i.test(authorizationId))
      throw new ConflictException('Authenticated import reviewer required');
    const tenantId=ctx.tenantId;
    return withTenant(tenantId,async tx=>{
      const [a]=await tx.select().from(gaizImportAuthorizations).where(and(
        eq(gaizImportAuthorizations.id,authorizationId),
        eq(gaizImportAuthorizations.tenantId,tenantId),
      )).for('update').limit(1);
      if(!a||a.status!=='approved'||a.expiresAt<=new Date()||
         !a.approvedBy||a.approvedBy===a.requestedBy)
        throw new ConflictException('Import authorization invalid');
      const [stage]=await tx.select().from(gaizImportRequests).where(and(
        eq(gaizImportRequests.id,a.stagingReviewId),
        eq(gaizImportRequests.tenantId,tenantId),
      )).limit(1);
      const [custody]=await tx.select().from(gaizCustodyAttempts).where(and(
        eq(gaizCustodyAttempts.id,a.custodyAttemptId),
        eq(gaizCustodyAttempts.tenantId,tenantId),
      )).limit(1);
      if(!stage||stage.status!=='approved'||stage.expiresAt<=new Date()||
         !stage.reviewedBy||stage.reviewedBy===stage.requestedBy||
         a.approvedBy===stage.requestedBy||
         !custody||custody.status!=='validated'||!custody.reportSha256||
         custody.reviewId!==stage.id||custody.artifactSha256!==stage.sha256)
         throw new ConflictException('Source review or custody has expired');
      // The current prototype only maps project title or portfolio summary.
      // Registry approval is required even for a dry-run commit readiness.
      const allowedKind=a.targetKind==='project'?'project':
        a.targetKind==='portfolio'?'portfolio':null;
      if(!allowedKind)throw new ConflictException('Unsupported target kind');
      const [profile]=await tx.select().from(gaizMappingProfiles).where(and(
        eq(gaizMappingProfiles.tenantId,tenantId),
        eq(gaizMappingProfiles.targetKind,allowedKind),
        eq(gaizMappingProfiles.profileId,a.mappingProfileId),
        eq(gaizMappingProfiles.status,'approved'),
      )).limit(1);
      const expectedField=allowedKind==='project'?'project.name':'portfolio.description';
      if(!profile||profile.fieldMappings.length!==1||
         profile.fieldMappings[0]!==expectedField)
        throw new ConflictException('Approved profile missing');
      let snapshot: {id:string;tenantId:string;kind:'project'|'portfolio';revision:number;
        fields:Record<string,string|null>};
      if(allowedKind==='project'){
        const [target]=await tx.select({
          id:projects.id,tenantId:projects.tenantId,
          revision:projects.revision,name:projects.name,
        }).from(projects).where(and(
          eq(projects.tenantId,tenantId),eq(projects.id,a.targetId),
        )).for('update').limit(1);
        if(!target)throw new ConflictException('Project missing');
        snapshot={id:target.id,tenantId:target.tenantId,kind:'project',
          revision:target.revision,fields:{name:target.name}};
      }else{
        const [target]=await tx.select({
          id:portfolios.id,tenantId:portfolios.tenantId,
          revision:portfolios.revision,description:portfolios.description,
        }).from(portfolios).where(and(
          eq(portfolios.tenantId,tenantId),eq(portfolios.id,a.targetId),
        )).for('update').limit(1);
        if(!target)throw new ConflictException('Portfolio missing');
        snapshot={id:target.id,tenantId:target.tenantId,kind:'portfolio',
          revision:target.revision,fields:{description:target.description}};
      }
      const fingerprint=fingerprintGaizTarget(snapshot);
      if(fingerprint!==a.targetSnapshotSha256)
        throw new ConflictException('Target changed; preview must be regenerated');
      return Object.freeze({
        status:'locked-readiness-inspected-no-commit',
        tenantId,authorizationId:a.id,targetId:a.targetId,targetKind:allowedKind,
        targetSnapshotSha256:fingerprint,previewSha256:a.previewSha256,
        custodyAttemptId:custody.id,reportSha256:custody.reportSha256,
        lockReleasedOnReturn:true,containsPlaintext:false,
        importAllowed:false,appliesData:false,proposedOperations:Object.freeze([]),
      });
    });
  }
}
