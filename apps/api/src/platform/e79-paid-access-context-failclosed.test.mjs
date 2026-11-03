import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./paid-deployment.controller.ts', import.meta.url), 'utf8');

test('missing authenticated request context is denied by the generic fail-closed handler', () => {
  const start = source.indexOf('async paidAccess()');
  const tryAt = source.indexOf('try {', start);
  const contextAt = source.indexOf('currentContext()', start);
  const catchAt = source.indexOf('} catch {', start);
  assert.ok(start >= 0 && tryAt > start && contextAt > tryAt && catchAt > contextAt);
  assert.match(source.slice(tryAt, catchAt), /if \(!tenantId \|\| !userId\) throw/);
  assert.match(source.slice(catchAt), /throw new ForbiddenException\('Access unavailable'\)/);
});

test('paid access remains bound to trusted tenant and current settlement evidence', () => {
  assert.match(source, /assertRuntimeDeploymentTenant\(runtime, \{ tenantId, userId \}\)/);
  assert.match(source, /withTenant\(tenantId,/);
  assert.match(source, /p\.provider_event_id = e\.details ->> 'eventId'/);
  assert.match(source, /r\.provider_event_id = p\.provider_event_id/);
  assert.match(source, /i\.period_starts_at = s\.period_starts_at/);
  assert.match(source, /i\.period_ends_at = s\.period_ends_at/);
  assert.doesNotMatch(source, /@Headers|@Query|req\.headers|x-tenant-id/);
});
