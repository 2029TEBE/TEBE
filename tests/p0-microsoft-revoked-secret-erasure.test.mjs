import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const start = service.indexOf('private async accessToken(resource: Resource)');
const end = service.indexOf('/* ── where the files go', start);
assert.ok(start >= 0 && end > start);
const access = service.slice(start, end);
const revoked = access.slice(access.indexOf('if (!(e instanceof MsAuthError && e.needsReconnect))'),
  access.indexOf('const credential = tok.refreshToken'));

test('E51: only provider-confirmed invalid credentials enter the erasure branch', () => {
  assert.match(access, /if \(e instanceof MsAuthError && e\.needsConsent\)/);
  assert.match(revoked, /if \(!\(e instanceof MsAuthError && e\.needsReconnect\)\)/);
  assert.match(revoked, /throw new ServiceUnavailableException/);
  assert.ok(revoked.indexOf('throw new ServiceUnavailableException') < revoked.indexOf('refresh_token = NULL'));
});

test('E51: confirmed revocation erases encrypted refresh token and invalidates cached bearers', () => {
  assert.match(revoked, /this\.invalidateTenantTokens\(tenantId\)/);
  assert.match(revoked, /UPDATE integration_connections\s+SET status = 'error', refresh_token = NULL,/);
  assert.match(revoked, /last_error = \$\{msg\}, updated_at = now\(\)/);
  assert.ok(revoked.indexOf('this.invalidateTenantTokens(tenantId)') < revoked.indexOf('UPDATE integration_connections'));
});

test('E51: stale revocation cannot erase a reconnected user credential or another owner', () => {
  assert.match(revoked, /WHERE provider = \$\{PROVIDER\} AND connected_by = \$\{userId\}/);
  assert.match(revoked, /AND status = 'connected' AND refresh_token = \$\{row\.refresh_token\}/);
  assert.doesNotMatch(revoked, /DELETE FROM integration_connections/);
  assert.doesNotMatch(revoked, /(?:console|this\.log)\.(?:log|warn|error)\([^)]*(?:row\.refresh_token|tok\.accessToken)/);
});
