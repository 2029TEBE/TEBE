import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// E59: source-bound checks supplement PostgreSQL/RLS and TS/build CI.
// Real Entra same-workspace two-user evidence remains separately BLOCKED.
const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const begin = source.indexOf('async browse(projectId?: string)');
const end = source.indexOf('async reports(', begin);
assert.ok(begin >= 0 && end > begin, 'bounded browse implementation exists');
const browse = source.slice(begin, end);
const legacyStart = browse.indexOf('\n    const { tenantId } = this.ctx();', browse.indexOf('return { items: items.map('));
assert.ok(legacyStart > 0, 'legacy branch must remain separate');
const preview = browse.slice(browse.indexOf('if (microsoftUserStorePreviewEnabled())'), legacyStart);
const legacy = browse.slice(legacyStart);

test('E59: preview browse uses the signed-in owner, never workspace-wide credentials', () => {
  assert.match(preview, /requireCapability\('pmoa_admin'\)/);
  assert.match(preview, /const ownerId = this\.ownerUserId\(\)/);
  assert.match(preview, /readUserMicrosoftConnection\(tenantId, ownerId\)/);
  assert.match(preview, /const token = await this\.accessToken\('graph'\)/);
  assert.doesNotMatch(preview, /FROM integration_connections|this\.connection\(tx\)/);
  assert.match(legacy, /this\.connection\(tx\)/);
});

test('E59: owner bearer must match exact sealed credential before Graph reads', () => {
  assert.match(preview, /this\.tokens\.get\(cacheKey\)/);
  assert.match(preview, /issued\.accessToken !== token/);
  assert.match(preview, /issued\.credential !== own\.sealedRefreshToken/);
  assert.match(preview, /!own\.driveId \|\| !own\.rootItemId/);
  assert.match(preview, /latest\.sealedRefreshToken !== own\.sealedRefreshToken/);
  assert.match(preview, /currentBearer\.credential !== own\.sealedRefreshToken/);
});

test('E59: tenant-scoped project lookup and Graph folder parent are checked', () => {
  assert.match(preview, /SELECT code, name FROM projects[\s\S]*?tenant_id = \$\{tenantId\}/);
  assert.match(preview, /folder\.parentReference\?\.id !== own\.rootItemId/);
  assert.match(preview, /folder\.parentReference\?\.driveId !== own\.driveId/);
  assert.match(preview, /!folder\.folder \|\| typeof folder\.folder !== 'object'/);
  assert.match(preview, /if \(e instanceof MsApiError && e\.status === 404\) \{\s*await assertStillOwner\(\)/);
});

test('E59: bounded read-only Graph listing rechecks owner before returning', () => {
  assert.match(preview, /const items = await callAll<any>\(GRAPH, token,/);
  assert.match(preview, /encodeURIComponent\(own\.driveId\)/);
  assert.match(preview, /encodeURIComponent\(parentId\)\}\/children\x60, 200\)/);
  assert.match(preview, /await assertStillOwner\(\)/);
  assert.doesNotMatch(preview, /method: 'POST'|method: 'PUT'|INSERT INTO documents/);
});

test('E59: Graph results cannot escape owner parent or return unsafe URLs/tokens', () => {
  assert.match(preview, /item\.parentReference\?\.id !== parentId/);
  assert.match(preview, /item\.parentReference\?\.driveId !== own\.driveId/);
  assert.match(preview, /safeDocumentRedirectUrl\(item\.webUrl\)/);
  assert.match(preview, /throw new ConflictException\('Microsoft returned an unsafe document link.'\)/);
  const output = preview.slice(preview.indexOf('return { items: items.map('));
  assert.doesNotMatch(output, /sealedRefreshToken|accessToken|refresh_token|credential/);
});
