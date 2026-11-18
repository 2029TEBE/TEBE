import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessAudit } from './dependency-security-audit.mjs';
const id = 'GHSA-fc5q-39xc-vjpf';
const report = { advisories: { 1: { severity: 'high', github_advisory_id: id, module_name: 'picomatch' } }, metadata: { vulnerabilities: { high: 1, critical: 0 } } };
test('confirmed withdrawal excludes only the withdrawn finding', async () => {
  const result = await assessAudit(report, async () => ({ ghsa_id: id, withdrawn_at: '2026-11-18T15:38:56Z' }));
  assert.equal(result.blocking, 0); assert.equal(result.withdrawn, 1);
});
test('active, unavailable, malformed, mismatched and future evidence all block', async () => {
  for (const evidence of [{ghsa_id:id,withdrawn_at:null}, {}, {ghsa_id:'GHSA-aaaa-bbbb-cccc',withdrawn_at:'2020-01-01'}, {ghsa_id:id,withdrawn_at:'2099-01-01'}]) {
    assert.equal((await assessAudit(report, async () => evidence)).blocking, 1);
  }
  assert.equal((await assessAudit(report, async () => { throw Error('offline'); })).blocking, 1);
});
test('a withdrawn advisory cannot hide another active critical advisory', async () => {
  const mixed = structuredClone(report);
  mixed.advisories[2] = { severity:'critical', github_advisory_id:'GHSA-aaaa-bbbb-cccc' };
  mixed.metadata.vulnerabilities.critical = 1;
  assert.equal((await assessAudit(mixed, async ghsa_id => ({ghsa_id, withdrawn_at:ghsa_id === id ? '2020-01-01' : null}))).blocking, 1);
});
test('malformed reports and unclassified counts fail closed', async () => {
  for (const input of [{}, {advisories:{},metadata:{vulnerabilities:{high:1}}}])
    await assert.rejects(assessAudit(input, async () => ({})));
});
