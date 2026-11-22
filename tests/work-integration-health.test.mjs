import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRONTEND_LOCALES } from '../apps/web/src/lib/frontend-locale.mjs';
import { formatNumber } from '../apps/web/src/lib/locale-format.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('My Work does not describe blocked approvals as signable', () => {
  const page = read('apps/web/src/app/(app)/my-work/page.tsx');
  assert.ok(page.includes('a.criteriaOutstanding > 0 || a.blockers > 0'), 'both criteria and blockers gate readiness');
  assert.ok(page.includes("labelFor('Blocked')"), 'blocked approval must not show ready label');
  assert.ok(page.includes('labelFor("ready to sign")'));
  assert.ok(page.includes("load={api.myWork}"), 'preserve authorized read');
  assert.doesNotMatch(page, /fetch\(|method="post"/, 'My Work remains read only');
});

test('My Work summary and assigned-content fields retain locale and bidi isolation', () => {
  const page = read('apps/web/src/app/(app)/my-work/page.tsx');
  for (const value of [
    'formatNumber(d.tasks.length, locale)',
    'formatNumber(d.approvals.length, locale)',
    'formatNumber(d.criteria.length, locale)',
    'formatNumber(d.tasks.filter((t: any) => t.overdue).length, locale)',
    'formatNumber(a.criteriaOutstanding, locale)',
    'num(d.effortLast7Days, 1, locale)',
    'when(t.dueDate, locale)',
    '<bdi>{a.projectCode}</bdi>', '<bdi>{a.gate}</bdi>',
    '<bdi>{c.label}</bdi>', '<bdi>{t.title}</bdi>',
  ]) assert.ok(page.includes(value), value);
});

test('integration health shows safe status and no arbitrary provider error payload', () => {
  const page = read('apps/web/src/app/(app)/integrations/page.tsx');
  for (const value of [
    "formatNumber(list.length, locale)",
    "formatNumber(list.filter((item: { status: string }) => item.status === 'connected').length, locale)",
    "formatNumber(list.filter((item: { status: string }) => item.status === 'error').length, locale)",
    '<bdi>{i.name}</bdi>', '<bdi>{i.provider}</bdi>',
    '<bdi>{i.direction}</bdi>', 'num(i.recordsSynced, 0, locale)',
    'ago(i.lastSyncAt, locale)', 't("Connection errors")',
    "mayManage={can(caps, 'pmoa_admin')}", 'api.microsoft().catch(() => null)',
  ]) assert.ok(page.includes(value), value);
  assert.doesNotMatch(page, />\{i\.lastError\}<\//, 'raw backend diagnostic must never reach HTML');
});

test('enterprise work and integration counters use all 23 frontend variants', () => {
  assert.equal(FRONTEND_LOCALES.length, 23);
  for (const locale of FRONTEND_LOCALES) {
    assert.equal(typeof formatNumber(12, locale), 'string');
    assert.ok(formatNumber(1234, locale).length > 0, locale);
  }
});
