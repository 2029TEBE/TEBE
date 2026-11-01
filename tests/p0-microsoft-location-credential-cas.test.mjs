import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const start = source.indexOf('async chooseLocation(');
const end = source.indexOf('/** Get a child folder', start);
assert.ok(start >= 0 && end > start, 'Microsoft location handler must exist');
// E57 adds a feature-flagged owner-scoped branch before the unchanged legacy
// implementation. Keep E47's ordering checks scoped to the legacy branch.
const wholeMethod = source.slice(start, end);
const legacyStart = wholeMethod.indexOf('const { tenantId, userId } = this.ctx();');
assert.ok(legacyStart > 0, 'legacy Microsoft destination path must remain available');
const method = wholeMethod.slice(legacyStart);

test('E47: capture owner credential after refresh and before Graph folder writes', () => {
  const snapshot = method.indexOf('const [locationCredential]');
  const drive = method.indexOf('const drive = await call');
  const folder = method.indexOf('const root = await this.folder');
  assert.ok(snapshot > 0 && snapshot < drive && drive < folder);
  assert.match(method, /SELECT refresh_token FROM integration_connections[\s\S]*?connected_by = \$\{userId\}[\s\S]*?status = 'connected' AND refresh_token IS NOT NULL/);
  // A reconnect in the gap between accessToken and the DB snapshot must
  // never bind an old Graph bearer to the new Microsoft identity.
  assert.match(method, /const issued = this\.tokens\.get\(/);
  assert.match(method, /issued\.accessToken !== token/);
  assert.match(method, /issued\.credential !== locationCredential\.refresh_token/);
  assert.ok(method.indexOf('issued.credential !== locationCredential.refresh_token') < drive);
});

test('E47: folder selection is conditional on same owner and exact encrypted credential', () => {
  const update = method.slice(method.indexOf('UPDATE integration_connections SET'));
  assert.match(update, /WHERE provider = \$\{PROVIDER\} AND connected_by = \$\{userId\}/);
  assert.match(update, /AND status = 'connected'/);
  assert.match(update, /AND refresh_token = \$\{locationCredential\.refresh_token\}/);
  assert.match(update, /RETURNING id/);
  assert.match(method, /if \(!done\) \{[\s\S]*?throw new ConflictException\('Microsoft connection changed during folder selection/);
});

test('E47: revoked or downgraded administrator cannot commit location after Graph returns', () => {
  const lock = method.indexOf('FOR SHARE OF m, u');
  const update = method.indexOf('UPDATE integration_connections SET');
  assert.ok(lock >= 0 && lock < update);
  assert.match(method, /JOIN users AS u ON u\.id = m\.user_id/);
  assert.match(method, /m\.tenant_id = \$\{tenantId\} AND m\.user_id = \$\{userId\}/);
  assert.match(method, /m\.is_active = true AND u\.is_active = true/);
  assert.match(method, /m\.role IN \('owner', 'admin', 'client_admin'\)/);
  assert.match(method, /if \(!authorized\) \{[\s\S]*?throw new ForbiddenException/);
});

test('E47: audit occurs only after successful compare-and-swap inside transaction', () => {
  const tx = method.indexOf('await withTenant(tenantId, async (tx) => {', method.indexOf('const root ='));
  const update = method.indexOf('UPDATE integration_connections SET', tx);
  const failure = method.indexOf('if (!done)', update);
  const audit = method.indexOf("this.audit(tx, PROVIDER, 'microsoft.location_set'", failure);
  assert.ok(tx >= 0 && update > tx && failure > update && audit > failure);
  assert.doesNotMatch(method, /log\.(?:log|warn|error)\([^)]*(?:refresh_token|locationCredential)/);
});
