import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessAudit, lookupAdvisory } from './dependency-security-audit.mjs';
const id = 'GHSA-fc5q-39xc-vjpf';
const report = { advisories: { 1: { severity: 'high', github_advisory_id: id, module_name: 'picomatch' } }, metadata: { vulnerabilities: { low: 0, moderate: 0, high: 1, critical: 0 } } };
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
test('advisory lookup authenticates only to GitHub and refuses redirects', async () => {
  const evidence = { ghsa_id: id, withdrawn_at: '2020-01-01' };
  const current = await lookupAdvisory(id, {
    token: 'synthetic-test-token',
    request: async (url, options) => {
      assert.equal(url, `https://api.github.com/advisories/${id}`);
      assert.equal(options.headers.Authorization, 'Bearer synthetic-test-token');
      assert.equal(options.headers['Cache-Control'], 'no-cache');
      assert.equal(options.redirect, 'error');
      return { ok: true, json: async () => evidence };
    }
  });
  assert.deepEqual(current, evidence);
});
test('transient lookup errors retry, while persistent failures still block', async () => {
  let attempts = 0;
  const current = await lookupAdvisory(id, {
    token: '',
    request: async () => {
      attempts++;
      if (attempts === 1) throw Error('transient network error');
      return { ok: true, json: async () => ({ ghsa_id: id, withdrawn_at: null }) };
    }
  });
  assert.equal(attempts, 2);
  assert.equal((await assessAudit(report, async () => current)).blocking, 1);
  attempts = 0;
  const assessment = await assessAudit(report, ghsa => lookupAdvisory(ghsa, {
    token: '',
    request: async () => { attempts++; return { ok: false, status: 503 }; }
  }));
  assert.equal(attempts, 3);
  assert.equal(assessment.blocking, 1);
});


test('remaining moderate and low advisories block the shared gate', async () => {
  for (const severity of ['moderate', 'low']) {
    const input = structuredClone(report);
    input.advisories[1].severity = severity;
    const result = await assessAudit(input, async () => ({ghsa_id:id, withdrawn_at:null}));
    assert.equal(result.blocking, 1);
  }
});

test('unknown severity and malformed counts cannot silently pass', async () => {
  const invalidSeverity = structuredClone(report);
  invalidSeverity.advisories[1].severity = 'unknown';
  await assert.rejects(assessAudit(invalidSeverity, async () => ({})));
  const invalidCount = structuredClone(report);
  invalidCount.metadata.vulnerabilities.low = '0';
  await assert.rejects(assessAudit(invalidCount, async () => ({})));
});
