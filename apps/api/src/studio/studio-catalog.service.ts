import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { withTenant } from '@pmo/db';
import {
  advanceDefinition, StudioPolicyError,
  LOCALE_CODES, type StudioDefinition, type StudioPrincipal, type StudioRole,
} from '@pmo/contracts';
import { can } from '@pmo/contracts';
import { studioPublicationReadiness } from './studio-readiness';
import { currentContext } from '../tenancy/tenant-context';

/**
 * Authenticated, opt-in metadata-only Studio catalogue.
 * No package import, execution, notification or external connector activation.
 * All transitions execute within a single RLS-scoped transaction.
 */
@Injectable()
export class StudioCatalogService {
  private caller(): StudioPrincipal {
    if (process.env.STUDIO_CATALOG_ENABLED !== 'true') throw new ServiceUnavailableException('Studio catalogue disabled');
    const ctx = currentContext();
    if (!ctx.userId) throw new ForbiddenException('Signed-in principal required');
    const caps = ctx.capabilities;
    const roles: StudioRole[] = ['requester'];
    if (can(caps,'pmoa_manage_projects')) roles.push('creator');
    if (can(caps,'pmoa_approve')) roles.push('reviewer');
    if (can(caps,'pmoa_admin')) roles.push('publisher');
    if (can(caps,'pmoa_manage_work')) roles.push('operator');
    return { id:ctx.userId, tenantId:ctx.tenantId, roles };
  }
  private rows<T>(result: unknown): T[] { return result as T[]; }
  async create(body: { serviceKey:string; definition:StudioDefinition }) {
    const caller=this.caller();
    if(!caller.roles.includes('creator')) throw new ForbiddenException('Creator permission required');
    const d=body.definition;
    if(!d || d.tenantId!==caller.tenantId || d.creatorId!==caller.id || d.state!=='draft' || d.version!==1
      || !d.id || !d.contentHash || d.reviewedHash || d.reviewerId) throw new ForbiddenException('Invalid draft owner/version');
    if (!/^[a-z][a-z0-9_-]{2,79}$/.test(body.serviceKey)) throw new ConflictException('Invalid service key');
    const allowed = (d as StudioDefinition & {accessUserIds?:string[]}).accessUserIds;
    if (!Array.isArray(allowed) || allowed.length === 0 || new Set(allowed).size !== allowed.length)
      throw new ConflictException('Explicit unique catalog audience required');
    const { contentHash: suppliedHash, ...canonical } = d;
    const calculatedHash = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
    if (calculatedHash !== suppliedHash) throw new ConflictException('Definition content checksum mismatch');
    return withTenant(caller.tenantId,async tx=>{
      const r=await tx.execute(sql`
        INSERT INTO studio_service_versions
          (tenant_id,service_key,version,state,definition,content_sha256,created_by)
        VALUES (${caller.tenantId},${body.serviceKey},1,'draft',${JSON.stringify(d)}::jsonb,
          ${d.contentHash},${caller.id})
        RETURNING id,service_key AS "serviceKey",version,state
      `);
      return this.rows(r)[0];
    });
  }
  /** Edit an unpublished draft only; verified state is read under a row lock.
   * A CAS digest prevents a stale editor from overwriting another person's work.
   * Creator, tenant and immutable record id are never taken from submitted JSON.
   */
  async updateDraft(id:string,patch:{
    expectedHash:string; name:Record<string,string>;
    accessUserIds:string[]; fields:StudioDefinition['fields']; steps:StudioDefinition['steps'];
  }) {
    const actor=this.caller();
    if(!actor.roles.includes('creator')) throw new ForbiddenException('Creator permission required');
    return withTenant(actor.tenantId,async tx=>{
      const {row,def}=await this.loadLocked(tx,actor.tenantId,id);
      if(row.state!=='draft' || row.creatorId!==actor.id)
        throw new ForbiddenException('Only the owning creator may edit an unpublished draft');
      if(patch.expectedHash!==row.contentHash)
        throw new ConflictException('Draft changed since the last load; reload before editing');
      if(!patch.accessUserIds.length || new Set(patch.accessUserIds).size!==patch.accessUserIds.length)
        throw new ConflictException('Explicit unique catalog audience required');
      // Do not mutate approvals, service identity, revision number or role bindings.
      const next={...def,name:patch.name,fields:patch.fields,steps:patch.steps,
        accessUserIds:patch.accessUserIds};
      const {contentHash:_hash,reviewedHash:_review,reviewerId:_reviewer,...canonical}=next;
      const hash=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
      const result=await tx.execute(sql`
        UPDATE studio_service_versions
        SET definition=${JSON.stringify({...canonical,contentHash:hash})}::jsonb,
            content_sha256=${hash}
        WHERE tenant_id=${actor.tenantId} AND id=${id} AND state='draft'
          AND created_by=${actor.id} AND content_sha256=${patch.expectedHash}
        RETURNING id,version,state,content_sha256 AS "contentHash"
      `);
      const updated=this.rows(result)[0];
      if(!updated)throw new ConflictException('Concurrent draft update');
      return updated;
    });
  }

  /** Clone a published or retired definition into a NEW draft version.
   * Published content and in-flight pinned requests are never rewritten.
   */
  async revise(id:string) {
    const actor=this.caller();
    if(!actor.roles.includes('creator')) throw new ForbiddenException('Creator permission required');
    return withTenant(actor.tenantId,async tx=>{
      const {row,def}=await this.loadLocked(tx,actor.tenantId,id);
      if(!['published','retired'].includes(row.state))
        throw new ConflictException('Only published or retired definitions can be revised');
      // Serialize concurrent revisions for this service key across all versions.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${actor.tenantId}),hashtext(${row.serviceKey}))`);
      const [existing]=this.rows<any>(await tx.execute(sql`
        SELECT version,state FROM studio_service_versions
        WHERE tenant_id=${actor.tenantId} AND service_key=${row.serviceKey}
        ORDER BY version DESC LIMIT 1
      `));
      if(existing?.state==='draft'||existing?.state==='in_review'||existing?.state==='approved')
        throw new ConflictException('Complete or retire the current draft before starting another revision');
      const nextVersion=Number(existing?.version??0)+1;
      if(!Number.isSafeInteger(nextVersion)||nextVersion>2147483647)
        throw new ConflictException('Version limit reached');
      const {contentHash:_hash,reviewedHash:_review,reviewerId:_reviewer,...original}=def;
      const canonical={...original,version:nextVersion,state:'draft' as const,creatorId:actor.id};
      const contentHash=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
      const rows=await tx.execute(sql`
        INSERT INTO studio_service_versions
          (tenant_id,service_key,version,state,definition,content_sha256,created_by)
        VALUES (${actor.tenantId},${row.serviceKey},${nextVersion},'draft',
          ${JSON.stringify({...canonical,contentHash})}::jsonb,${contentHash},${actor.id})
        RETURNING id,service_key AS "serviceKey",version,state
      `);
      return this.rows(rows)[0];
    });
  }

  /** The draft schema is private to its owning creator and authorized reviewers.
   * Never expose it via the public service catalog.
   */
  async definitionDetail(id:string) {
    const actor=this.caller();
    if(!actor.roles.some(role=>['creator','reviewer','publisher'].includes(role)))
      throw new ForbiddenException('Studio governance permission required');
    const result=await withTenant(actor.tenantId,tx=>tx.execute(sql`
      SELECT id,service_key AS "serviceKey",version,state,definition,
             content_sha256 AS "contentHash",created_by AS "creatorId"
      FROM studio_service_versions
      WHERE tenant_id=${actor.tenantId} AND id=${id}
        AND (created_by=${actor.id} OR ${actor.roles.includes('reviewer')||actor.roles.includes('publisher')})
      LIMIT 1
    `));
    const item=this.rows(result)[0];
    if(!item)throw new ForbiddenException('Definition unavailable');
    return item;
  }

  private async loadLocked(tx:any,tenantId:string,id:string) {
    const r=await tx.execute(sql`
      SELECT id,service_key AS "serviceKey", version,state,definition,content_sha256 AS "contentHash",
             reviewed_sha256 AS "reviewedHash",created_by AS "creatorId",
             reviewed_by AS "reviewerId",published_by AS "publisherId"
      FROM studio_service_versions WHERE id=${id} AND tenant_id=${tenantId} FOR UPDATE
    `);
    const row=this.rows<any>(r)[0];
    if(!row) throw new ConflictException('Studio definition not found');
    const def={...row.definition, id:row.definition.id, tenantId,version:row.version,
      state:row.state,contentHash:row.contentHash,reviewedHash:row.reviewedHash??undefined,
      creatorId:row.creatorId,reviewerId:row.reviewerId??undefined} as StudioDefinition;
    return {row,def};
  }
  async transition(id:string,action:'submit_review'|'approve'|'publish'|'retire') {
    const caller=this.caller();
    return withTenant(caller.tenantId,async tx=>{
      const {row,def}=await this.loadLocked(tx,caller.tenantId,id);
      // All 23 currently registered application variants are required unless
      // a reviewed tenant-enabled locale registry is wired up separately.
      let next: StudioDefinition;
      try { next=advanceDefinition(caller,def,action,LOCALE_CODES); }
      catch (error) {
        if (error instanceof StudioPolicyError) {
          if (error.code.endsWith('FORBIDDEN') || error.code === 'ROLE_FORBIDDEN' || error.code === 'SEPARATION_OF_DUTIES')
            throw new ForbiddenException(error.code);
          throw new ConflictException(error.code);
        }
        throw error;
      }
      const data = await tx.execute(sql`
        UPDATE studio_service_versions
        SET state=${next.state},
            reviewed_by=${action==='approve'?caller.id:(row.reviewerId??null)},
            reviewed_sha256=${action==='approve'?next.contentHash:(row.reviewedHash??null)},
            reviewed_at=CASE WHEN ${action}='approve' THEN now() ELSE reviewed_at END,
            published_by=CASE WHEN ${action}='publish' THEN ${caller.id} ELSE published_by END,
            published_at=CASE WHEN ${action}='publish' THEN now() ELSE published_at END
        WHERE id=${id} AND tenant_id=${caller.tenantId} AND state=${row.state}
        RETURNING id,state,version
      `);
      const updated=this.rows(data)[0];
      if(!updated) throw new ConflictException('State changed concurrently');
      return updated;
    });
  }
  async readiness(id:string) {
    const caller=this.caller();
    if(!caller.roles.some(role=>['creator','reviewer','publisher'].includes(role)))
      throw new ForbiddenException('Governance permission required');
    const rows=await withTenant(caller.tenantId,tx=>tx.execute(sql`
      SELECT definition,state,content_sha256 AS "contentHash",created_by AS "creatorId",
             reviewed_sha256 AS "reviewedHash",reviewed_by AS "reviewerId",version
      FROM studio_service_versions
      WHERE tenant_id=${caller.tenantId} AND id=${id}
        AND (created_by=${caller.id} OR ${caller.roles.includes('reviewer')||caller.roles.includes('publisher')})
      LIMIT 1
    `));
    const row=this.rows<any>(rows)[0];
    if(!row) throw new ForbiddenException('Definition unavailable');
    const d={...row.definition,tenantId:caller.tenantId,state:row.state,
      creatorId:row.creatorId,reviewedHash:row.reviewedHash??undefined,
      reviewerId:row.reviewerId??undefined,version:row.version,contentHash:row.contentHash} as StudioDefinition;
    return {state:row.state,...studioPublicationReadiness(d)};
  }
  async catalog() {
    const caller=this.caller();
    const rows=await withTenant(caller.tenantId,tx=>tx.execute(sql`
      SELECT id,service_key AS "serviceKey",version,definition->'name' AS name
      FROM studio_service_versions
      WHERE tenant_id=${caller.tenantId} AND state='published'
        AND definition->'accessUserIds' @> ${JSON.stringify([caller.id])}::jsonb
      ORDER BY service_key LIMIT 100
    `));
    return this.rows(rows);
  }
  /** Return only a published form schema, never workflow assignee identities. */
  async catalogItem(id:string) {
    const caller=this.caller();
    const rows=await withTenant(caller.tenantId,tx=>tx.execute(sql`
      SELECT id,service_key AS "serviceKey",version,definition->'name' AS name,
             definition->'fields' AS fields
      FROM studio_service_versions
      WHERE tenant_id=${caller.tenantId} AND id=${id} AND state='published'
        AND definition->'accessUserIds' @> ${JSON.stringify([caller.id])}::jsonb
      LIMIT 1
    `));
    const item=this.rows<any>(rows)[0];
    if(!item) throw new ForbiddenException('Service not available to this account');
    return item;
  }
  async myDefinitions() {
    const caller=this.caller();
    if(!caller.roles.some(role=>role==='creator'||role==='reviewer'||role==='publisher'))
      throw new ForbiddenException('Studio access forbidden');
    const rows=await withTenant(caller.tenantId,tx=>tx.execute(sql`
      SELECT id,service_key AS "serviceKey",version,state,created_by AS "creatorId"
      FROM studio_service_versions
      WHERE tenant_id=${caller.tenantId}
        AND (created_by=${caller.id} OR ${caller.roles.includes('reviewer') || caller.roles.includes('publisher')})
      ORDER BY created_at DESC LIMIT 100
    `));
    return this.rows(rows);
  }
}
