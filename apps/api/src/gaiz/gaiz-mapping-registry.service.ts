import { ConflictException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { gaizMappingProfiles, auditEvents, withTenant } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';

/** Internal-only mapping profile registry, no HTTP or decrypted report fields. */
@Injectable()
export class GaizMappingRegistryService {
  private actor() {
    if(process.env.NODE_ENV!=='development' ||
       (process.env.DEPLOYMENT_ENV && process.env.DEPLOYMENT_ENV!=='development') ||
       process.env.GAIZ_MAPPING_REGISTRY_ENABLED!=='true')
      throw new ConflictException('GAIZ mapping profiles disabled');
    requireCapability('pmoa_admin');
    const session=currentContext();
    if(!session.userId)throw new ConflictException('Authenticated reviewer required');
    return {tenantId:session.tenantId,actorId:session.userId};
  }
  async request(profileId:string,targetKind:'project'|'portfolio') {
    const {tenantId,actorId}=this.actor();
    if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(profileId)||
       !['project','portfolio'].includes(targetKind))
      throw new ConflictException('Unsupported GAIZ profile');
    const paths=targetKind==='project'?['project.name']:['portfolio.description'];
    return withTenant(tenantId,async tx=>{
      const [row]=await tx.insert(gaizMappingProfiles).values({
        tenantId,profileId,targetKind,fieldMappings:paths,requestedBy:actorId,
      }).onConflictDoNothing().returning({id:gaizMappingProfiles.id});
      if(!row)throw new ConflictException('Duplicate mapping profile');
      await tx.insert(auditEvents).values({
        tenantId,actorId,entity:'gaiz_mapping_profile',entityId:row.id,
        action:'gaiz.mapping.requested',diff:{profileId,targetKind},
      });
      return Object.freeze({profileId,targetKind,status:'pending',importAllowed:false});
    });
  }
  async review(profileId:string,decision:'approved'|'rejected') {
    const {tenantId,actorId}=this.actor();
    if(!['approved','rejected'].includes(decision))throw new ConflictException('Invalid decision');
    return withTenant(tenantId,async tx=>{
      const [row]=await tx.update(gaizMappingProfiles).set({
        status:decision,reviewedBy:actorId,reviewedAt:new Date(),
      }).where(and(
        eq(gaizMappingProfiles.tenantId,tenantId),
        eq(gaizMappingProfiles.profileId,profileId),
        eq(gaizMappingProfiles.status,'pending'),
      )).returning({id:gaizMappingProfiles.id,requestedBy:gaizMappingProfiles.requestedBy});
      if(!row||row.requestedBy===actorId)
        throw new ConflictException('Profile not pending or self-review denied');
      await tx.insert(auditEvents).values({
        tenantId,actorId,entity:'gaiz_mapping_profile',entityId:row.id,
        action:decision==='approved'?'gaiz.mapping.approved':'gaiz.mapping.rejected',
        diff:{profileId},
      });
      return Object.freeze({profileId,status:decision,importAllowed:false});
    });
  }
  async getApprovedInternal(profileId:string,targetKind:'project'|'portfolio'){
    const {tenantId}=this.actor();
    const [row]=await withTenant(tenantId,tx=>tx.select({
      profileId:gaizMappingProfiles.profileId,
      targetKind:gaizMappingProfiles.targetKind,
      fieldMappings:gaizMappingProfiles.fieldMappings,
      status:gaizMappingProfiles.status,
    }).from(gaizMappingProfiles).where(and(
      eq(gaizMappingProfiles.tenantId,tenantId),
      eq(gaizMappingProfiles.profileId,profileId),
      eq(gaizMappingProfiles.targetKind,targetKind),
      eq(gaizMappingProfiles.status,'approved'),
    )).limit(1));
    const expected=targetKind==='project'?'project.name':'portfolio.description';
    if(!row||row.fieldMappings.length!==1||row.fieldMappings[0]!==expected)
      throw new ConflictException('Approved mapping profile unavailable');
    return Object.freeze({tenantId,profileId:row.profileId,targetKind,
      approved:true,fieldMappings:Object.freeze([expected])});
  }
}
