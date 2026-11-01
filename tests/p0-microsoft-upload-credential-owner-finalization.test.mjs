import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const start = service.indexOf('async upload(b:');
const end = service.indexOf('/** Graph\'s resumable upload', start);
assert.ok(start >= 0 && end > start, 'Microsoft Graph upload handler must exist');
const upload = service.slice(start, end);

test('E48: snapshot exact owner credential after Graph token acquisition and before sending file bytes', () => {
  const token = upload.indexOf("const token = await this.accessToken('graph')");
  const snapshot = upload.indexOf('const [uploadCredential]');
  const issued = upload.indexOf('const issued = this.tokens.get(');
  const graph = upload.indexOf('const item = await this.uploadLarge(');
  assert.ok(token >= 0 && snapshot > token && issued > snapshot && graph > issued);
  assert.match(upload, /SELECT refresh_token FROM integration_connections[\s\S]*?connected_by = \$\{userId\}[\s\S]*?status = 'connected' AND refresh_token IS NOT NULL/);
  assert.match(upload, /issued\.accessToken !== token/);
  assert.match(upload, /issued\.credential !== uploadCredential\.refresh_token/);
  assert.match(upload.slice(issued, graph), /throw new ConflictException\('Microsoft connection changed before upload/);
});

test('E48: finalization locks active administrator and user before local document insert', () => {
  const finalization = upload.indexOf('const doc = await withTenant(tenantId');
  const membership = upload.indexOf('FROM memberships AS m', finalization);
  const lock = upload.indexOf('FOR SHARE OF m, u', membership);
  const connection = upload.indexOf('FROM integration_connections', lock);
  const insert = upload.indexOf('INSERT INTO documents', connection);
  assert.ok(finalization >= 0 && membership > finalization && lock > membership &&
    connection > lock && insert > connection);
  assert.match(upload.slice(membership, lock), /JOIN users AS u ON u\.id = m\.user_id/);
  assert.match(upload.slice(membership, lock), /m\.tenant_id = \$\{tenantId\} AND m\.user_id = \$\{userId\}/);
  assert.match(upload.slice(membership, lock), /m\.is_active = true AND u\.is_active = true/);
  assert.match(upload.slice(membership, lock), /m\.role IN \('owner', 'admin', 'client_admin'\)/);
  assert.match(upload.slice(lock, connection), /if \(!authorized\)[\s\S]*?throw new ForbiddenException/);
});

test('E48: finalization refuses changed or revoked credentials even if destination is unchanged', () => {
  const finalization = upload.slice(upload.indexOf('const doc = await withTenant(tenantId'));
  const connection = finalization.slice(finalization.indexOf('SELECT id FROM integration_connections'));
  assert.match(connection, /connected_by = \$\{userId\}/);
  assert.match(connection, /status = 'connected' AND drive_id = \$\{c\.drive_id\}/);
  assert.match(connection, /root_item_id = \$\{c\.root_item_id\}/);
  assert.match(connection, /AND refresh_token = \$\{uploadCredential\.refresh_token\}/);
  assert.match(connection, /FOR SHARE/);
  assert.ok(connection.indexOf('FOR SHARE') < connection.indexOf('INSERT INTO documents'));
  assert.match(connection, /if \(!active\)[\s\S]*?throw new ConflictException/);
});

test('E48: no credential or bearer appears in document metadata, audit or logs', () => {
  const insert = upload.slice(upload.indexOf('INSERT INTO documents'));
  assert.doesNotMatch(insert, /\$\{(?:token|issued|uploadCredential)(?:\.|\})/);
  assert.doesNotMatch(upload, /(?:this\.log|console)\.(?:log|warn|error)\([^)]*(?:token|issued|uploadCredential)/);
  assert.match(upload, /await this\.audit\(tx, d\.id, 'document\.uploaded'/);
});
