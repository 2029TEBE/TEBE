import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('approval readiness queue keeps API gate logic and safely localizes record presentation', () => {
  const page = read('apps/web/src/app/(app)/approvals/page.tsx');
  const required = [
    "const locale = await getFrontendLocale()",
    "t('Approvals')",
    "t('Nothing awaiting approval.')",
    "formatNumber(pending.length, locale)",
    "formatNumber(ready.length, locale)",
    "formatNumber(pending.length - ready.length, locale)",
    "formatNumber(a.criteriaOutstanding, locale)",
    "formatNumber(a.blockers, locale)",
    "when(a.decidedAt, locale)",
    "a.criteriaOutstanding === 0 && a.blockers === 0",
    "a.criteriaOutstanding > 0 || a.blockers > 0",
    "<bdi>{a.projectCode}</bdi>",
    "<bdi>{a.projectName}</bdi>",
    "<bdi>{a.gate}</bdi>",
    "<bdi>{a.approver}</bdi>",
    "href=\"/governance\"",
  ];
  for (const value of required) assert.ok(page.includes(value), 'approvals: ' + value);
  assert.ok((page.match(/<th scope="col">/g) || []).length >= 6);
  assert.doesNotMatch(page, /method="post"|fetch\(/, 'queue remains read-only');
});

test('decision register counts are locale aware without changing authorized data reads', () => {
  const page = read('apps/web/src/app/(app)/decisions/page.tsx');
  const required = [
    "const locale = await getFrontendLocale()",
    "load={api.decisions}",
    "formatNumber(list.length, locale)",
    "formatNumber(list.filter((d: { atGate?: string | null }) => Boolean(d.atGate)).length, locale)",
    "formatNumber(list.filter((d: { owner?: string | null }) => Boolean(d.owner)).length, locale)",
    "when(d.decidedAt, locale)",
    '<time dateTime={d.decidedAt}>',
    "<bdi>{d.title}</bdi>",
    "<bdi>{d.projectCode}</bdi>",
    "<bdi>{d.owner}</bdi>",
  ];
  for (const value of required) assert.ok(page.includes(value), 'decisions: ' + value);
  assert.doesNotMatch(page, /method="post"|fetch\(/, 'decision register remains read-only');
});

test('numbers are rendered in every supported frontend locale without altering source counts', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { formatNumber } = await import('../apps/web/src/lib/locale-format.mjs');
  assert.equal(FRONTEND_LOCALES.length, 23);
  for (const locale of FRONTEND_LOCALES) {
    for (const value of [0, 1, 1234]) {
      const formatted = formatNumber(value, locale);
      assert.ok(typeof formatted === 'string' && formatted.trim(), locale);
      assert.equal(new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-arab' : locale).format(value), formatted, locale);
    }
  }
});
