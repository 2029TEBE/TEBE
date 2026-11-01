import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const store = readFileSync(new URL('../apps/api/src/microsoft/user-connection-store.ts', import.meta.url), 'utf8');
const between = (start, end) => {
  const a = service.indexOf(start);
  const b = service.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'expected bounded Microsoft service section');
  return service.slice(a, b);
};

test('preview status reads only authenticated owner and returns a public metadata whitelist', () => {
  const s = between('async status():', 'async beginConnect(');
  assert.match(s, /readUserMicrosoftConnection\(tenantId, this\.ownerUserId\(\)\)/);
  assert.ok(s.indexOf('microsoftUserStorePreviewEnabled()') < s.indexOf('FROM integration_connections'));
  const publicBranch = s.slice(s.indexOf('if (microsoftUserStorePreviewEnabled())'), s.indexOf('const row = await withTenant'));
  assert.doesNotMatch(publicBranch, /sealedRefreshToken|refresh_token|accessToken/);
  assert.match(publicBranch, /connection: own \? \{/);
});

test('OAuth callback persists consent from consumed state user, never workspace owner', () => {
  const s = between('async completeConnect(', 'async disconnect(');
  assert.match(s, /saveUserMicrosoftConsent\(tenantId, st\.user_id,/);
  assert.ok(s.indexOf('saveUserMicrosoftConsent(') < s.indexOf('INSERT INTO integration_connections'));
  assert.match(s, /this\.tokens\.delete\(`\$\{tenantId\}:\$\{st\.user_id\}:graph`\)/);
  assert.match(s, /if \(!eligible\)/);
});

test('preview refresh and revocation are owner-scoped with exact credential CAS', () => {
  const legacy = between('private async accessToken(', 'async places(');
  assert.match(legacy, /if \(microsoftUserStorePreviewEnabled\(\)\) return this\.previewAccessToken\(resource\)/);
  const s = between('private async previewAccessToken(', '\n}');
  assert.match(s, /hit\.credential === sealedCredential/);
  assert.match(s, /markUserMicrosoftCredentialRevoked\(tenantId, ownerId, sealedCredential\)/);
  assert.match(s, /rotateUserMicrosoftCredential\(\s*tenantId, ownerId, sealedCredential/);
  assert.ok(s.indexOf('rotateUserMicrosoftCredential(') < s.indexOf('this.tokens.set(cacheKey'));
  assert.doesNotMatch(s, /FROM integration_connections/);
});

test('preview disconnect removes only owner row, and audit is transactional', () => {
  const s = between('async disconnect(', 'private async accessToken(');
  assert.match(s, /deleteUserMicrosoftConnection\(tenantId, ownerId\)/);
  assert.ok(s.indexOf('deleteUserMicrosoftConnection(') < s.indexOf('DELETE FROM integration_connections'));
  assert.match(store, /action: 'microsoft.connected'/);
  assert.match(store, /action: 'microsoft.disconnected'/);
  assert.match(store, /WHERE tenant_id = \$\{tenantId\} AND user_id = \$\{userId\}/);
});

test('preview Power BI catalogue is owner-bound; transferable embed bearer still fails closed', () => {
  const listing = between('async reports(', 'async embed(');
  assert.match(listing, /microsoftUserStorePreviewEnabled\(\)/);
  assert.match(listing, /requireCapability\('pmoa_admin'\)/);
  assert.match(listing, /readUserMicrosoftConnection\(tenantId, ownerId\)/);
  assert.match(listing, /powerBiReportSummary\(/);
  const preview = listing.slice(0, listing.indexOf('// This is a workspace-level delegated'));
  assert.doesNotMatch(preview, /FROM integration_connections/);
  assert.doesNotMatch(preview, /accessToken: token/);
  const embed = between('async embed(', '\n}');
  assert.match(embed, /microsoftUserStorePreviewEnabled\(\)/);
  assert.match(embed, /throw new ServiceUnavailableException/);
});
