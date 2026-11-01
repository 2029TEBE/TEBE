import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const store = readFileSync(new URL('../apps/api/src/microsoft/user-connection-store.ts', import.meta.url), 'utf8');
const section = (text, start, end) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'expected bounded source section');
  return text.slice(a, b);
};
const choose = section(service, 'async chooseLocation(', 'private async folder(');
const preview = section(choose, 'if (microsoftUserStorePreviewEnabled())', 'const { tenantId, userId } = this.ctx();');
const dao = section(store, 'export async function setUserMicrosoftLocation(', '\n}');

test('E57 preview destination uses the signed-in consenting owner and never legacy workspace credentials', () => {
  assert.match(preview, /const ownerId = this\.ownerUserId\(\)/);
  assert.match(preview, /readUserMicrosoftConnection\(tenantId, ownerId\)/);
  assert.match(preview, /this\.tokens\.get\(`\$\{tenantId\}:\$\{ownerId\}:graph`\)/);
  assert.match(preview, /issued\.accessToken !== token/);
  assert.match(preview, /issued\.credential !== own\.sealedRefreshToken/);
  assert.doesNotMatch(preview, /integration_connections|connected_by|refresh_token/);
});

test('E57 Graph destination selection verifies drive and site before owner-scoped CAS', () => {
  assert.match(preview, /drive\.id !== b\.driveId/);
  assert.match(preview, /site\?\.id !== b\.siteId/);
  assert.match(preview, /this\.folder\(token, b\.driveId, 'root', folder\)/);
  assert.match(preview, /setUserMicrosoftLocation\(\s*tenantId, ownerId, own\.sealedRefreshToken/);
  assert.ok(preview.indexOf('this.folder(') < preview.indexOf('setUserMicrosoftLocation('));
  assert.match(preview, /if \(!saved\)\s*throw new ConflictException/);
  assert.ok(choose.indexOf('if (microsoftUserStorePreviewEnabled())') < choose.indexOf('FROM integration_connections'));
});

test('E57 DAO commits location only for active owner, exact credential and same tenant with audit', () => {
  assert.match(dao, /return withOwner\(tenantId, userId/);
  assert.match(dao, /WHERE tenant_id = \$\{tenantId\} AND user_id = \$\{userId\}/);
  assert.match(dao, /AND provider = 'microsoft' AND status = 'connected'/);
  assert.match(dao, /AND refresh_token = \$\{expectedSealedToken\}/);
  assert.match(dao, /action: 'microsoft.location_set'/);
  assert.match(dao, /if \(saved\.length === 1\)/);
  assert.match(store, /FOR SHARE OF m, u/);
});

test('E57 owner status exposes selected folder but no ciphertext or access token', () => {
  const status = section(service, 'async status():', 'async beginConnect(');
  const previewStatus = section(status, 'if (microsoftUserStorePreviewEnabled())', 'const row = await withTenant');
  assert.match(store, /rootPath: row\.root_path/);
  assert.match(previewStatus, /rootItemId: own\.rootItemId, rootPath: own\.rootPath/);
  assert.doesNotMatch(previewStatus, /sealedRefreshToken|refresh_token|accessToken/);
});
