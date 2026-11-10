import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('localization candidate inventory runs and reports only counts and paths', () => {
  const result = spawnSync(process.execPath,
    [new URL('./i18n-inline-inventory.mjs', import.meta.url).pathname],
    { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.completenessCertified, false);
  assert.equal(report.audit, 'source-candidates-only');
  assert.ok(Number.isInteger(report.filesWithCandidates));
  assert.equal(report.records.length, report.filesWithCandidates);
  assert.equal(report.arabicLines, report.records.reduce((s, r) => s + r.arabicLines, 0));
  assert.equal(report.inlineLocaleBranches, report.records.reduce((s, r) => s + r.inlineLocaleBranches, 0));
  for (const record of report.records) {
    assert.match(record.file, /^apps\/(?:web|api)\/src\//);
    assert.ok(Number.isInteger(record.arabicLines));
    assert.ok(Number.isInteger(record.inlineLocaleBranches));
  }
});
