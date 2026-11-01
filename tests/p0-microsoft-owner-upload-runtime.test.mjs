import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// E58: the preview upload is a real user-bound runtime path, not another probe.
// Static guards complement the PostgreSQL/TypeScript/Graph transport CI suite;
// real two-user Entra acceptance remains an external staging receipt.
const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const begin = source.indexOf('async upload(b:');
const end = source.indexOf('private async uploadLarge(', begin);
assert.ok(begin >= 0 && end > begin, 'bounded upload handler exists');
const upload = source.slice(begin, end);
const beforeGraph = upload.slice(0, upload.indexOf('const item = await this.uploadLarge('));
const afterGraph = upload.slice(upload.indexOf('const doc = await withTenant(tenantId'));
const legacy = afterGraph.slice(afterGraph.indexOf('SELECT id FROM integration_connections'));

test('E58: opt-in preview reads only the signed-in consenting user, never the workspace credential', () => {
  assert.match(upload, /const previewUserStore = microsoftUserStorePreviewEnabled\(\)/);
  assert.match(beforeGraph, /readUserMicrosoftConnection\(tenantId, this\.ownerUserId\(\)\)/);
  assert.match(beforeGraph, /const \[uploadCredential\] = previewUserStore\s*\? \[\{ refresh_token: ownerConnection\?\.status === 'connected'/);
  assert.match(beforeGraph, /const c = previewUserStore\s*\? \{ drive_id: ownerConnection\?\.driveId, root_item_id: ownerConnection\?\.rootItemId \}/);
  assert.match(beforeGraph, /: await withTenant\(tenantId, \(tx\) => this\.connection\(tx\)\)/);
});

test('E58: upload bytes require exact cached bearer and encrypted credential match', () => {
  assert.match(beforeGraph, /const issued = this\.tokens\.get\(\x60\$\{tenantId\}:\$\{userId\}:graph\x60\)/);
  assert.match(beforeGraph, /issued\.accessToken !== token/);
  assert.match(beforeGraph, /issued\.credential !== uploadCredential\.refresh_token/);
  assert.match(beforeGraph, /if \(!c\.drive_id \|\| !c\.root_item_id\)/);
  assert.match(beforeGraph, /const current = await readUserMicrosoftConnection\(tenantId, this\.ownerUserId\(\)\)/);
  assert.match(beforeGraph, /current\.sealedRefreshToken !== uploadCredential\.refresh_token/);
  assert.match(beforeGraph, /current\.driveId !== c\.drive_id \|\| current\.rootItemId !== c\.root_item_id/);
  assert.match(beforeGraph, /throw new ConflictException\('Microsoft connection changed before upload/);
  assert.match(upload, /const item = await this\.uploadLarge\(token, c\.drive_id, parentId, filename, file\.buffer\)/);
});

test('E58: finalization enforces owner RLS, active admin locks, destination and credential CAS', () => {
  const admin = afterGraph.indexOf('FOR SHARE OF m, u');
  const ownerRls = afterGraph.indexOf("set_config('app.user_id'");
  const ownRow = afterGraph.indexOf('SELECT id FROM microsoft_user_connections');
  const insert = afterGraph.indexOf('INSERT INTO documents');
  assert.ok(admin >= 0 && ownerRls > admin && ownRow > ownerRls && insert > ownRow);
  const guarded = afterGraph.slice(ownRow, insert);
  assert.match(guarded, /tenant_id = \$\{tenantId\} AND user_id = \$\{userId\}/);
  assert.match(guarded, /status = 'connected' AND drive_id = \$\{c\.drive_id\}/);
  assert.match(guarded, /root_item_id = \$\{c\.root_item_id\}/);
  assert.match(guarded, /refresh_token = \$\{uploadCredential\.refresh_token\}/);
  assert.match(guarded, /FOR SHARE/);
  assert.match(guarded, /if \(!active\)[\s\S]*?throw new ConflictException/);
});

test('E58: disabled flag preserves the legacy consenting-owner SQL and gate evidence guards', () => {
  assert.match(legacy, /connected_by = \$\{userId\}/);
  assert.match(legacy, /refresh_token = \$\{uploadCredential\.refresh_token\}/);
  assert.match(beforeGraph, /SELECT gc\.id FROM gate_criteria AS gc[\s\S]*?gc\.tenant_id = \$\{tenantId\}/);
  assert.match(afterGraph, /FOR SHARE OF gc, g/);
  assert.match(upload, /await this\.audit\(tx, d\.id, 'document\.uploaded'/);
  const metadata = upload.slice(upload.indexOf('INSERT INTO documents'));
  assert.doesNotMatch(metadata, /\$\{(?:token|issued|uploadCredential)(?:\.|\})/);
});
