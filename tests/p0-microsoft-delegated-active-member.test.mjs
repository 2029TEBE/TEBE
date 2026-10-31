import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const start = source.indexOf('private async accessToken(resource: Resource)');
const end = source.indexOf('/* ── where the files go', start);
assert.ok(start >= 0 && end > start, 'delegated token path must exist');
const access = source.slice(start, end);

test('E50: every Graph/Power BI token request checks active EPMO user and admin membership before cache hit', () => {
  const guard = access.indexOf('const [activeDelegate]');
  const hit = access.indexOf('const hit = this.tokens.get(cacheKey)');
  const refresh = access.indexOf('tok = await refresh(');
  assert.ok(guard > 0 && hit > guard && refresh > hit, 'active member check must precede cache and refresh');
  const sql = access.slice(guard, hit);
  assert.match(sql, /JOIN users AS u ON u\.id = m\.user_id/);
  assert.match(sql, /m\.tenant_id = \$\{tenantId\} AND m\.user_id = \$\{userId\}/);
  assert.match(sql, /m\.is_active = true AND u\.is_active = true/);
  assert.match(sql, /m\.role IN \('owner', 'admin', 'client_admin'\)/);
  assert.match(sql, /if \(!activeDelegate\)[\s\S]*?this\.tokens\.delete\(cacheKey\);[\s\S]*?throw new ForbiddenException/);
});

test('E50: delegated cache remains bound to consenting owner, current credential and connected status', () => {
  const hit = access.indexOf('const hit = this.tokens.get(cacheKey)');
  assert.match(access.slice(0, hit), /canUseDelegatedMicrosoftConnection\(row\.connected_by, userId\)/);
  assert.match(access.slice(0, hit), /isActiveDelegatedMicrosoftConnection\(row\.status\)/);
  assert.match(access, /hit\.credential === row\.refresh_token/);
  assert.match(access, /\$\{tenantId\}:\$\{userId\}:\$\{resource\}/);
});

test('E50: refresh transaction locks active user and membership before credential CAS', () => {
  const begin = access.indexOf('const updated = await withTenant(');
  const lock = access.indexOf('FOR SHARE OF m, u', begin);
  const cas = access.indexOf('UPDATE integration_connections', begin);
  const cache = access.indexOf('this.tokens.set(cacheKey', begin);
  assert.ok(begin > 0 && lock > begin && cas > lock && cache > cas);
  const tx = access.slice(begin, cache);
  assert.match(tx, /JOIN users AS u ON u\.id = m\.user_id/);
  assert.match(tx, /m\.is_active = true AND u\.is_active = true/);
  assert.match(tx, /m\.role IN \('owner', 'admin', 'client_admin'\)/);
  assert.match(tx, /if \(!stillActive\) return \[\]/);
  assert.match(tx, /connected_by = \$\{userId\}/);
  assert.match(tx, /status = 'connected' AND refresh_token = \$\{row\.refresh_token\}/);
  assert.match(tx, /if \(!updated\.length\)[\s\S]*?this\.tokens\.delete\(cacheKey\)/);
});

test('E50: no delegated bearer or refresh credential is written to diagnostic logs', () => {
  assert.doesNotMatch(access, /(?:console|this\.log)\.(?:log|warn|error)\([^)]*(?:accessToken|refresh_token|credential|tok\.accessToken)/);
});
