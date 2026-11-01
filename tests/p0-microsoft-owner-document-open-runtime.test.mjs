import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// E60: bounded source checks complement full CI and independent provider UAT.
// The two-user same-workspace Entra receipt remains externally BLOCKED.
const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const begin = source.indexOf('async documentLink(documentId: string)');
const end = source.indexOf('/** What is in the workspace folder right now', begin);
assert.ok(begin >= 0 && end > begin, 'documentLink method exists');
const method = source.slice(begin, end);
const previewStart = method.indexOf('if (previewUserStore)');
const legacyStart = method.lastIndexOf("const token = await this.accessToken('graph');");
assert.ok(previewStart >= 0 && legacyStart > previewStart, 'isolated preview and legacy branches');
const preview = method.slice(previewStart, legacyStart);
const legacy = method.slice(legacyStart);

test('E60: document lookup is tenant-scoped and preview never borrows another uploader identity', () => {
  assert.match(method, /FROM documents WHERE id = \$\{documentId\} AND tenant_id = \$\{tenantId\}/);
  assert.match(method, /SELECT name, external_drive_id, external_item_id, storage_provider, url, owner_id/);
  assert.match(preview, /requireCapability\('pmoa_admin'\)/);
  assert.match(preview, /const ownerId = this\.ownerUserId\(\)/);
  assert.match(preview, /!d\.external_item_id \|\| d\.owner_id !== ownerId/);
  assert.match(method.slice(0, previewStart), /!previewUserStore && !d\.external_item_id/);
  assert.match(preview, /throw new NotFoundException\('No such Microsoft document for your connection\.'\)/);
});

test('E60: preview Graph read is bound to exact owner credential, bearer and drive', () => {
  assert.match(preview, /readUserMicrosoftConnection\(tenantId, ownerId\)/);
  assert.match(preview, /own\.driveId !== d\.external_drive_id/);
  assert.match(preview, /issued\.accessToken !== token/);
  assert.match(preview, /issued\.credential !== own\.sealedRefreshToken/);
  assert.match(preview, /encodeURIComponent\(own\.driveId\)/);
  assert.match(preview, /encodeURIComponent\(d\.external_item_id\)/);
  assert.doesNotMatch(preview, /FROM integration_connections|this\.connection\(tx\)/);
});

test('E60: Graph item identity and parent drive are verified before redirect', () => {
  assert.match(preview, /item\.id !== d\.external_item_id/);
  assert.match(preview, /item\.folder/);
  assert.match(preview, /item\.parentReference\?\.driveId !== own\.driveId/);
  assert.match(preview, /safeDocumentRedirectUrl\(item\['@microsoft\.graph\.downloadUrl'\] \?\? item\.webUrl\)/);
});

test('E60: revocation, refresh and administrator downgrade fail closed after Graph response', () => {
  const graph = preview.indexOf('const item = await call<any>(GRAPH, token');
  const reread = preview.lastIndexOf('readUserMicrosoftConnection(tenantId, ownerId)');
  const output = preview.lastIndexOf('return { url: safeUrl, name: d.name };');
  assert.ok(graph >= 0 && reread > graph && output > reread);
  assert.match(preview, /latest\.sealedRefreshToken !== own\.sealedRefreshToken/);
  assert.match(preview, /currentBearer\.accessToken !== token/);
  assert.match(preview, /currentBearer\.credential !== own\.sealedRefreshToken/);
  assert.doesNotMatch(preview.slice(output), /accessToken:|sealedRefreshToken:|credential:/);
});

test('E60: feature-off legacy Graph and non-Microsoft safe-link behavior are preserved', () => {
  assert.match(method.slice(0, previewStart), /d\.storage_provider !== PROVIDER/);
  assert.match(method.slice(0, previewStart), /safeDocumentRedirectUrl\(d\.url\)/);
  assert.match(legacy, /encodeURIComponent\(d\.external_drive_id\)/);
  assert.match(legacy, /encodeURIComponent\(d\.external_item_id\)/);
  assert.match(legacy, /safeDocumentRedirectUrl/);
});
