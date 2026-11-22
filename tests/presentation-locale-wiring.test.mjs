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

test('reports, board pack, analytics, financials, benefits and task board use selected locale for display values', () => {
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
