import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./paid-deployment.controller.ts', import.meta.url), 'utf8');

test('paid-access SQL keeps receipt digest and settlement predicates in one EXISTS', () => {
  const begin = source.indexOf('const result = await withTenant(');
  const end = source.indexOf('if (!Array.isArray(result)', begin);
  assert.ok(begin >= 0 && end > begin);
  const block = source.slice(begin, end);
  assert.match(block, /r\.payload_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(block, /WHERE e\.tenant_id = s\.tenant_id/);
  assert.match(block, /i\.period_starts_at = s\.period_starts_at/);
  assert.match(block, /i\.period_ends_at = s\.period_ends_at/);
  assert.match(block, /LIMIT 1\s*`\)\);/);
  assert.doesNotMatch(block, /return\s*\{/);
});

test('paid-access controller has one fail-closed return path after receipt verification', () => {
  assert.equal((source.match(/return\s*\{\s*deploymentId:/g) ?? []).length, 1);
  assert.equal((source.match(/throw new ForbiddenException\('Access unavailable'\)/g) ?? []).length, 1);
  assert.match(source, /if \(!Array\.isArray\(result\) \|\| result\.length !== 1\)/);
  assert.match(source, /\}\s*$/);
});
