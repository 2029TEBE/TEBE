import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('shared date/number formatter delegates to tested 23-locale presentation module', () => {
  const source = read('apps/web/src/lib/fmt.ts');
  assert.match(source, /export \{ money, num, pct, when, ago \} from '\.\/presentation-values\.mjs'/);
  const moduleSource = read('apps/web/src/lib/presentation-values.mjs');
  assert.match(moduleSource, /presentationLocale\(locale\)/);
  assert.match(moduleSource, /Number\.isFinite\(n\)/);
  assert.match(moduleSource, /new Intl\.DateTimeFormat/);
  assert.match(moduleSource, /new Intl\.RelativeTimeFormat/);
});

test('twenty application routes use the selected frontend locale for financial, date and time display', () => {
  const checks = new Map([
    ['apps/web/src/app/(app)/reports/page.tsx', ["when(r.lastRunAt, locale)"]],
    ['apps/web/src/app/(app)/reports/board-pack/page.tsx', [
      'when(new Date().toISOString(), locale)', 'money(totals.budget, locale)',
      'pct(o.health.avg_progress, locale)', 'money(r.actual, locale)']],
    ['apps/web/src/app/(app)/analytics/page.tsx', [
      'money(v, locale)', 'money(s.budget, locale)', 'pct((s.actual / s.budget) * 100, locale)']],
    ['apps/web/src/app/(app)/board/page.tsx', ['when(t.dueDate, locale)']],
    ['apps/web/src/app/(app)/financials/page.tsx', [
      'money(tot.budget, locale)', 'num(r.cpi, 2, locale)', 'money(r.variance, locale)']],
    ['apps/web/src/app/(app)/benefits/page.tsx', [
      'num(b.baseline, 0, locale)', 'num(b.target, 0, locale)', 'when(b.reviewDate, locale)']],
    ['apps/web/src/app/(app)/activity/page.tsx', ['when(n.due, locale)', 'ago(e.at, locale)']],
    ['apps/web/src/app/(app)/approvals/page.tsx', ['when(a.decidedAt, locale)']],
    ['apps/web/src/app/(app)/ask/page.tsx', ['ago(m.createdAt, locale)', 'ago(x.createdAt, locale)']],
    ['apps/web/src/app/(app)/decisions/page.tsx', ['when(d.decidedAt, locale)']],
    ['apps/web/src/app/(app)/documents/page.tsx', ['when(d.updatedAt, locale)']],
    ['apps/web/src/app/(app)/integrations/page.tsx', ['num(i.recordsSynced, 0, locale)', 'ago(i.lastSyncAt, locale)']],
    ['apps/web/src/app/(app)/my-work/page.tsx', ['num(d.effortLast7Days, 1, locale)', 'when(t.dueDate, locale)']],
    ['apps/web/src/app/(app)/notifications/page.tsx', ['when(m.sentAt, locale)', 'ago(m.createdAt, locale)']],
    ['apps/web/src/app/(app)/planner/page.tsx', ['when(i.baselineStart, locale)', 'when(i.baselineEnd, locale)', 'when(i.endDate, locale)']],
    ['apps/web/src/app/(app)/platform/page.tsx', ['when(m.enabledAt, locale)']],
    ['apps/web/src/app/(app)/resources/page.tsx', ['num(p.hoursLast7, 1, locale)']],
    ['apps/web/src/app/(app)/settings/page.tsx', ['when(d.tenant.createdAt, locale)']],
    ['apps/web/src/app/(app)/studio/page.tsx', ['ago(a.lastRunAt, locale)']],
    ['apps/web/src/app/(app)/updates/page.tsx', ['ago(u.createdAt, locale)']],
  ]);
  for (const [path, calls] of checks) {
    const source = read(path);
    assert.ok(source.includes('const locale = await getFrontendLocale()'), path + ': selected locale');
    for (const call of calls) assert.ok(source.includes(call), path + ': ' + call);
  }
});

test('user-facing numeric formatting does not modify the existing backend export contract', () => {
  const reports = read('apps/web/src/app/(app)/reports/page.tsx');
  assert.ok(reports.includes('const lang = await getLang()'));
  for (const suffix of ['docx', 'pptx', 'pdf']) {
    assert.ok(reports.includes(`board-pack.${suffix}?lang=\${lang}`), suffix + ': unchanged backend language contract');
  }
  const appI18n = read('apps/web/src/lib/i18n.ts');
  assert.match(appI18n, /export async function getLang\(\): Promise<Lang>/);
});
