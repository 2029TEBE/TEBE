import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCurrentMicrosoftGraphRead } from '../apps/api/src/microsoft/user-connection-policy.ts';

const connected = { status: 'connected', sealedRefreshToken: 'sealed-owner-A' };
const issued = { accessToken: 'bearer-owner-A', credential: 'sealed-owner-A' };

test('E63: only the current consenting owner credential can release a Graph read', () => {
  assert.equal(isCurrentMicrosoftGraphRead(connected, issued, 'bearer-owner-A'), true);
  for (const [owner, cache, token] of [
    [null, issued, 'bearer-owner-A'],
    [{ ...connected, status: 'error' }, issued, 'bearer-owner-A'],
    [{ ...connected, status: 'disconnected' }, issued, 'bearer-owner-A'],
    [{ ...connected, sealedRefreshToken: null }, issued, 'bearer-owner-A'],
    [{ ...connected, sealedRefreshToken: 'sealed-owner-B' }, issued, 'bearer-owner-A'],
    [connected, undefined, 'bearer-owner-A'],
    [connected, { ...issued, credential: 'sealed-owner-B' }, 'bearer-owner-A'],
    [connected, { ...issued, accessToken: 'bearer-owner-B' }, 'bearer-owner-A'],
    [connected, issued, 'bearer-owner-B'],
    [connected, issued, ''],
  ]) {
    assert.equal(isCurrentMicrosoftGraphRead(owner, cache, token), false);
  }
});

test('E63: Graph places and drives recheck after network calls, without changing legacy mode', () => {
  const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('private async assertCurrentPreviewGraphRead('),
    source.indexOf('private invalidateTenantTokens('));
  assert.match(method, /if \(!microsoftUserStorePreviewEnabled\(\)\) return;/);
  assert.match(method, /readUserMicrosoftConnection\(tenantId, ownerId\)/);
  assert.match(method, /isCurrentMicrosoftGraphRead\(own, issued, token\)/);
  assert.match(method, /throw new ConflictException/);
  const places = source.slice(source.indexOf('async places('), source.indexOf('async drives('));
  assert.match(places, /const sites = await callAll[\s\S]*?await this\.assertCurrentPreviewGraphRead\(token\);[\s\S]*?const me = await call/);
  assert.match(places, /const me = await call[\s\S]*?await this\.assertCurrentPreviewGraphRead\(token\);[\s\S]*?return \{/);
  const drives = source.slice(source.indexOf('async drives('), source.indexOf('async chooseLocation('));
  assert.match(drives, /const list = await callAll[\s\S]*?await this\.assertCurrentPreviewGraphRead\(token\);[\s\S]*?return list\.map/);
});
