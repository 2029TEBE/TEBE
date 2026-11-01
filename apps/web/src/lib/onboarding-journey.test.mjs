import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadVerifiedOnboardingJourney, validOnboardingJourneyPayload } from './onboarding-journey.mjs';

const payload = () => ({
  tenant: { id: 'synthetic', name: 'Workspace A', slug: 'workspace-a' },
  completed: 1, total: 2, percent: 50, nextStep: 'team',
  tasks: [
    { key: 'workspace', completed: true, capability: 'read' },
    { key: 'team', completed: false, capability: 'pmoa_manage_people' },
  ],
});

test('authenticated onboarding and module status load together', async () => {
  const result = await loadVerifiedOnboardingJourney(async () => payload(), async () => ['core360', 'pmo360']);
  assert.equal(result.data.nextStep, 'team');
  assert.deepEqual(result.modules, ['core360', 'pmo360']);
});

test('401 expired session, 403 permission and 503 outage reject instead of showing task links', async () => {
  for (const status of [401, 403, 503]) {
    const error = Object.assign(new Error('Synthetic failure'), { status });
    await assert.rejects(
      loadVerifiedOnboardingJourney(async () => payload(), async () => { throw error; }),
      actual => actual === error,
    );
    await assert.rejects(
      loadVerifiedOnboardingJourney(async () => { throw error; }, async () => ['pmo360']),
      actual => actual === error,
    );
  }
});

test('malformed module replies fail closed rather than unlocking onboarding actions', async () => {
  for (const modules of [null, 'pmo360', {}, ['pmo360', null], ['<script>'], [''], Array(101).fill('pmo360')]) {
    assert.equal(validOnboardingJourneyPayload(payload(), modules), false);
    await assert.rejects(loadVerifiedOnboardingJourney(async () => payload(), async () => modules), /Invalid onboarding response/);
  }
});

test('truncated or ambiguous onboarding tasks cannot become actionable navigation', async () => {
  for (const bad of [
    { ...payload(), tenant: null },
    { ...payload(), tasks: [] },
    { ...payload(), nextStep: 'not-a-route' },
    { ...payload(), nextStep: 'workspace' },
    { ...payload(), tasks: [payload().tasks[0], payload().tasks[0]] },
    { ...payload(), tasks: [{ key: 'team', completed: false, capability: 'admin' }] },
    { ...payload(), percent: 120 },
  ]) assert.equal(validOnboardingJourneyPayload(bad, ['pmo360']), false);
});

test('getting-started uses fail-closed loader and bilingual error boundary', () => {
  const page = readFileSync(new URL('../app/(app)/getting-started/page.tsx', import.meta.url), 'utf8');
  const boundary = readFileSync(new URL('../components/Page.tsx', import.meta.url), 'utf8');
  assert.match(page, /loadVerifiedOnboardingJourney\(api\.onboarding, api\.enabledModules\)/);
  assert.doesNotMatch(page, /enabledModules\(\)\.catch/);
  assert.match(page, /<Loaded load=/);
  assert.match(boundary, /err\.status === 401/);
  assert.match(boundary, /err\.status === 403/);
  assert.match(boundary, /role="alert"/);
});
