import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { auditEvents, withTenant } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';

const rows=(result: unknown) => result as unknown as any[];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * DISCONNECTED disposable-only executor for previously verified, mapped and
 * independently human-approved GAIZ governance report drafts.
 *
 * No route, module, scheduled worker or production registration exists. This
 * class MUST NOT be wired until TO conformance, trusted key custody, tamper-
 * resistant proposal writes, tenant RLS and transaction acceptance are passed.
 * No untrusted caller supplies the draft title/fields or verification flags.
 */
@Injectable()
export class GaizDraftImportExecutor {
  async execute(importId: string, expectedRevision: number) {
    if (process.env.NODE_ENV === 'production' || process.env.GAIZ_DEV_ONLY !== 'true')
      throw new ServiceUnavailableException('GAIZ draft import is disabled');
    const ctx=currentContext();
    if(!ctx.userId || !UUID.test(ctx.userId) || !UUID.test(ctx.tenantId) ||
       !UUID.test(importId) || !Number.isSafeInteger(expectedRevision) || expectedRevision<0)
      throw new ForbiddenException('Invalid GAIZ execution context');
    requireCapability('pmoa_manage_projects');

    const {tenantId,userId}=ctx;
    return withTenant(tenantId, async tx=>{
      // Session capability alone is insufficient: recheck active membership.
      const [member]=rows(await tx.execute(sql`
        SELECT m.id FROM memberships m JOIN users u ON u.id=m.user_id
        WHERE m.tenant_id=${tenantId} AND m.user_id=${userId}
          AND m.is_active=true AND u.is_active=true FOR SHARE OF m
      `));
      if(!member)throw new ForbiddenException('Active workspace membership required');

      // Serializes all concurrent attempts for the same import and ensures a
      // transaction failure rolls back the record, receipt and audit together.
      const [job]=rows(await tx.execute(sql`
        SELECT j.id,j.state,j.revision,
               j.requested_by AS "requestedBy",j.approved_by AS "approvedBy",
               j.approval_decided_at AS "approvedAt",
               j.mapping_validated_at AS "mappingValidatedAt",
               j.correlation_id AS "correlationId",
               j.idempotency_request_sha256 AS "requestSha",
               a.id AS "artifactDbId",a.artifact_id AS "artifactId",
               a.envelope_sha256 AS "envelopeSha",
               a.issuer_key_id AS "issuerKeyId",
               a.verification_status AS "verificationStatus",
               a.content_integrity_verified_at AS "integrityVerifiedAt",
               q.envelope_sha256 AS "quarantineSha",
               q.expires_at AS "quarantineExpiresAt"
        FROM gaiz_import_jobs j
        JOIN gaiz_artifacts a ON a.id=j.artifact_ref AND a.tenant_id=j.tenant_id
        JOIN gaiz_quarantine_blobs q ON q.id=j.quarantine_ref AND q.tenant_id=j.tenant_id
        WHERE j.id=${importId} AND j.tenant_id=${tenantId}
        FOR UPDATE OF j
      `));
      if(!job)throw new NotFoundException('GAIZ import not found');

      if(job.state==='imported'){
        const [receipt]=rows(await tx.execute(sql`
          SELECT document_id AS "documentId",correlation_id AS "correlationId"
          FROM gaiz_import_receipts
          WHERE tenant_id=${tenantId} AND import_id=${importId}
        `));
        if(!receipt)throw new ConflictException('GAIZ import receipt missing');
        return Object.freeze({importId,documentId:receipt.documentId,
          correlationId:receipt.correlationId,replayed:true});
      }
      if(job.state!=='approved' || job.revision!==expectedRevision ||
         !job.requestedBy || !job.approvedBy ||
         userId===job.approvedBy || job.requestedBy===job.approvedBy ||
         !job.approvedAt || !job.mappingValidatedAt ||
         !Number.isFinite(new Date(job.approvedAt).getTime()) ||
         Date.now()-new Date(job.approvedAt).getTime()>15*60*1000 ||
         new Date(job.approvedAt).getTime()>Date.now() ||
         job.verificationStatus!=='verified' || !job.integrityVerifiedAt ||
         job.envelopeSha!==job.quarantineSha || job.requestSha!==job.envelopeSha ||
         new Date(job.quarantineExpiresAt).getTime()<=Date.now())
        throw new ConflictException('GAIZ approval or provenance is no longer valid');

      const [decision]=rows(await tx.execute(sql`
        SELECT id FROM gaiz_decisions
        WHERE tenant_id=${tenantId} AND import_id=${importId}
          AND actor_id=${job.approvedBy} AND outcome='approved'
        LIMIT 1
      `));
      if(!decision)throw new ConflictException('No persisted human approval');
      const [mapping]=rows(await tx.execute(sql`
        SELECT document_title AS "title",document_summary AS "summary",
               target_project_id AS "projectId",schema_version AS "schemaVersion",
               source_artifact_sha256 AS "sourceSha",validated_at AS "validatedAt"
        FROM gaiz_import_proposals
        WHERE tenant_id=${tenantId} AND import_id=${importId}
        LIMIT 1
      `));
      if(!mapping || mapping.schemaVersion!==1 ||
         mapping.sourceSha!==job.envelopeSha || !mapping.validatedAt ||
         new Date(mapping.validatedAt).getTime()!==new Date(job.mappingValidatedAt).getTime() ||
         new Date(mapping.validatedAt).getTime()>new Date(job.approvedAt).getTime() ||
         typeof mapping.title!=='string' || mapping.title.length===0 ||
         mapping.title.length>200 || /[<>\x00-\x1f]/.test(mapping.title) ||
         typeof mapping.summary!=='string' || mapping.summary.length===0 ||
         mapping.summary.length>5000 || /[<>\x00-\x1f]/.test(mapping.summary))
        throw new ConflictException('GAIZ verified mapping is unavailable or changed');
      if(mapping.projectId){
        const [project]=rows(await tx.execute(sql`
          SELECT id FROM projects WHERE id=${mapping.projectId} AND tenant_id=${tenantId}
        `));
        if(!project)throw new NotFoundException('Target project not in workspace');
      }

      // Only a DRAFT document with no user-supplied URL; no governance gate,
      // approval or project state is modified. The summary remains protected
      // in a separate mapping table, not written into arbitrary document URLs.
      const [document]=rows(await tx.execute(sql`
        INSERT INTO documents
          (tenant_id,project_id,name,kind,version,status,url,owner_id)
        VALUES (${tenantId},${mapping.projectId??null},${mapping.title},
                'GAIZ governance report','1.0','draft'::doc_status,NULL,${userId})
        RETURNING id,name
      `));
      if(!document)throw new ConflictException('Failed to create draft');

      await tx.execute(sql`
        INSERT INTO gaiz_import_receipts
          (id,tenant_id,import_id,document_id,envelope_sha256,correlation_id,executed_by)
        VALUES (${randomUUID()},${tenantId},${importId},${document.id},
                ${job.envelopeSha},${job.correlationId},${userId})
      `);
      const [updated]=rows(await tx.execute(sql`
        UPDATE gaiz_import_jobs
        SET state='imported',revision=revision+1,updated_at=now()
        WHERE id=${importId} AND tenant_id=${tenantId}
          AND state='approved' AND revision=${expectedRevision}
        RETURNING id
      `));
      if(!updated)throw new ConflictException('Concurrent GAIZ import denied');
      await tx.insert(auditEvents).values({
        tenantId,actorId:userId,entity:'document',entityId:document.id,
        action:'gaiz.draft_imported',
        diff:{importId,artifactId:job.artifactId,issuerKeyId:job.issuerKeyId,
          envelopeSha256:job.envelopeSha,correlationId:job.correlationId},
      });
      return Object.freeze({importId,documentId:document.id,
        correlationId:job.correlationId,replayed:false});
    });
  }
}
