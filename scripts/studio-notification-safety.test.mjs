import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const notify=readFileSync(resolve(root,'apps/api/src/notify/notify.service.ts'),'utf8');
const templates=readFileSync(resolve(root,'apps/api/src/notify/templates.ts'),'utf8');

test('Studio escalation dispatch is doubly feature gated and tenant opted in',()=>{
 assert.match(notify,/STUDIO_CATALOG_ENABLED === 'true'/);
 assert.match(notify,/STUDIO_ESCALATION_NOTIFICATIONS_ENABLED === 'true'/);
 assert.match(notify,/on\.has\('studio\.approval\.overdue'\)/);
 assert.match(notify,/withTenant\(t\.id/);
});

test('overdue notification is admin-only with bounded queries and durable deduplication',()=>{
 const block=notify.slice(notify.indexOf('private async studioOverdue('),notify.indexOf('private async gateBlocked('));
 assert.match(block,/r\.tenant_id=\$\{t\.id\}/);
 assert.match(block,/r\.phase IN \('manager','finance'\)/);
 assert.match(block,/m\.role IN \('owner','admin'\)/);
 assert.match(block,/LIMIT 100/g);
 assert.match(block,/studio\.approval\.overdue:\$\{request\.id\}/);
 assert.match(notify,/ON CONFLICT \(tenant_id, dedupe_key\) DO NOTHING/);
 assert.doesNotMatch(block,/UPDATE studio_service_requests|INSERT INTO studio_service_decisions|INSERT INTO studio_approval_delegations/);
});

test('overdue notification content is metadata only, not requester values or files',()=>{
 const block=templates.slice(templates.indexOf("case 'studio.approval.overdue':"),templates.indexOf("case 'gate.blocked':"));
 assert.match(block,/human review required/);
 assert.match(block,/لا يتم تنفيذ أي موافقة أو رفض تلقائي/);
 assert.doesNotMatch(block,/submitted_values|artifact_reference|budgetImpact|attachments/);
});
