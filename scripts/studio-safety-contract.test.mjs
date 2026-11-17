import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Defense-in-depth regression checks for the Studio feature-flagged runtime.
// These are static contract checks; DB/RLS and user-flow tests remain mandatory.
const root=resolve(import.meta.dirname,'..');
const source=(file)=>readFileSync(resolve(root,file),'utf8');
const controller=source('apps/api/src/studio/studio-request.controller.ts');
const service=source('apps/api/src/studio/studio-request.service.ts');
const triage=source('apps/web/src/app/(app)/studio/services/escalations/page.tsx');

test('Studio request runtime remains opt-in and tenant scoped',()=>{
 assert.match(service,/STUDIO_CATALOG_ENABLED\s*!==\s*'true'/);
 assert.match(service,/withTenant\(actor\.tenantId/);
 assert.match(service,/r\.tenant_id=\$\{actor\.tenantId\}/);
});

test('delegation is an explicit admin-only human action with validated justification',()=>{
 assert.match(controller,/@Post\(':id\/delegate'\)/);
 assert.match(controller,/reason:z\.string\(\)\.trim\(\)\.min\(10\)\.max\(1000\)/);
 const section=service.slice(service.indexOf('async delegateApproval('),service.indexOf('async assignedApprovals('));
 assert.ok(section.length>0,'delegation implementation missing');
 assert.match(section,/actor\.roles\.includes\('publisher'\)/);
 assert.match(section,/request\.requesterId===body\.delegateId/);
 assert.match(section,/request\.phase!==body\.step/);
 assert.match(section,/studio_approval_delegations/);
 assert.match(section,/approved:false,phaseChanged:false,notified:false/);
});

test('escalation acknowledgment remains auditable but never casts approval votes',()=>{
 const section=service.slice(service.indexOf('async recordEscalationReview('),service.indexOf('async myRequests('));
 assert.ok(section.length>0,'escalation acknowledgment implementation missing');
 assert.match(section,/actor\.roles\.includes\('publisher'\)/);
 assert.match(section,/sla\.status!=='overdue'/);
 assert.match(section,/INSERT INTO studio_escalation_reviews/);
 assert.doesNotMatch(section,/INSERT INTO studio_service_decisions|UPDATE studio_service_requests/);
 assert.match(section,/autoDecision:false,autoDelegation:false/);
 assert.match(triage,/Overdue flags do not mean approval, rejection, reassignment, or notification occurred/);
});

test('digest-only evidence never claims verified GAIZ or executed fulfillment',()=>{
 assert.match(controller,/artifactReference:z\.string\(\)\.regex\(\/\^sha256:/);
 const section=service.slice(service.indexOf('async attachEvidence('),service.indexOf('async delegateApproval('));
 assert.ok(section.length>0,'evidence implementation missing');
 assert.match(section,/request\.phase!=='fulfillment'/);
 assert.match(section,/steps\.fulfillment\.assignees\.includes\(actor\.id\)/);
 assert.match(section,/verified:false,workflowCompleted:false/);
});

test('request audit is administrator-only, tenant-scoped, bounded, and read-only',()=>{
 assert.match(controller,/@Get\(':id\/audit'\)/);
 const section=service.slice(service.indexOf('async requestAudit('),service.indexOf('async assignedApprovals('));
 assert.ok(section.length>0,'request audit endpoint missing');
 assert.match(section,/actor\.roles\.includes\('publisher'\)/);
 assert.match(section,/withTenant\(actor\.tenantId/);
 assert.match(section,/tenant_id=\$\{actor\.tenantId\} AND request_id=\$\{id\}/);
 assert.match(section,/studio_approval_delegations/);
 assert.match(section,/studio_escalation_reviews/);
 assert.match(section,/LIMIT 100/g);
 assert.doesNotMatch(section,/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
 assert.match(section,/readOnly:true,autoDecision:false,autoDelegation:false/);
});

test('admin audit screen is read-only and scoped to authorized tenant admins',()=>{
 const page=source('apps/web/src/app/(app)/studio/services/escalations/[id]/audit/page.tsx');
 const queue=source('apps/web/src/app/(app)/studio/services/escalations/page.tsx');
 const api=source('apps/web/src/lib/api.ts');
 assert.match(page,/session\.capabilities\.includes\('pmoa_admin'\)/);
 assert.match(page,/uuid\.test\(id\)/);
 assert.match(page,/api\.studioRequestAudit\(id\)/);
 assert.match(page,/read-only records/);
 assert.doesNotMatch(page,/action=\{|method="POST"|fetch\(/);
 assert.match(queue,/View history/);
 assert.match(api,/studioRequestAudit:/);
});
