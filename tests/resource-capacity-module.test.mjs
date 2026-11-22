import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRONTEND_LOCALES } from '../apps/web/src/lib/frontend-locale.mjs';
import { UI_LABELS, uiLabel, catalogLocale, translationHasMatchingPlaceholders } from '../apps/web/src/lib/ui-labels.mjs';
import { capacityValue, capacityBarFill, isOverAllocated } from '../apps/web/src/lib/resource-capacity.mjs';
import { num } from '../apps/web/src/lib/presentation-values.mjs';

const page = readFileSync(new URL('../apps/web/src/app/(app)/resources/page.tsx', import.meta.url), 'utf8');
const LABELS = [
  'Resources',
  'Who is working on what, and who is over-committed. Over-allocation is the earliest warning of slippage.',
  'Resource capacity snapshot', 'DELIVERY CAPACITY', 'People capacity overview',
  'Metrics describe only resource records returned by the authorized API, not necessarily the entire organization.',
  'Returned people', 'Allocated above 100%', 'Returned allocations',
  'Capacity', 'Person', 'Projects', 'Allocated', 'Load', 'Hours, 7 days',
  'over-committed by', 'Allocations by project', 'Project', 'Role', 'Allocation',
];
test('resource capacity calculations guard absent and nonfinite data, preserve over-allocation text', () => {
  for (const invalid of [null, undefined, NaN, Infinity, -Infinity, -10, '120', {}]) {
    assert.equal(capacityValue(invalid), false);
    assert.equal(capacityBarFill(invalid), 0);
    assert.equal(isOverAllocated(invalid), false);
  }
  for (const valid of [0, 89, 90, 100, 105, 200]) assert.equal(capacityValue(valid), true);
  assert.equal(capacityBarFill(90), 90);
  assert.equal(capacityBarFill(105), 100);
  assert.equal(capacityBarFill(200), 100);
  assert.equal(isOverAllocated(100), false);
  assert.equal(isOverAllocated(101), true);
});

test('entire resource-capacity view uses selected locale and retains authorized create workflows', () => {
  for (const str of [
    'const locale = await getFrontendLocale()',
    'const t = await tr()',
    "t('Resources')",
    "t('Resource capacity snapshot')",
    "t('Allocated above 100%')",
    "t('Returned allocations')",
    'isOverAllocated(p.allocatedPct)',
    'capacityBarFill(p.allocatedPct)',
    'capacityValue(a.allocationPct)',
    'formatNumber(d.people.length, locale)',
    'formatNumber(d.byProject.length, locale)',
    'num(p.allocatedPct, 0, locale)',
    'num(a.allocationPct, 0, locale)',
    'num(p.hoursLast7, 1, locale)',
    '<bdi>{p.name}</bdi>', '<bdi>{a.projectCode}</bdi>',
    'load={api.resources}',
    '<NewRecord lang={lang} kind="allocation"',
    "kind=\"allocation\"",
    'min: 1, max: 100, step: 1',
    "const over = isOverAllocated(p.allocatedPct)",
  ]) assert.ok(page.includes(str), str);
  assert.doesNotMatch(page, /lang === 'ar' \?/, 'no English/Arabic-only capacity page labels');
  assert.ok(page.includes("hasAllocation ? 'good' : 'dim'"));
});

test('all resource dashboard and table labels resolve for each supported frontend locale variant', () => {
  assert.equal(FRONTEND_LOCALES.length, 23);
  for (const label of LABELS) {
    for (const locale of FRONTEND_LOCALES) {
      const translated = uiLabel(label, locale);
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.ok(translationHasMatchingPlaceholders(label, translated), locale + ': placeholders');
      if (!locale.startsWith('en-')) {
        assert.equal(translated, UI_LABELS[label]?.[catalogLocale(locale)], locale + ': explicit translation');
      }
    }
  }
  for (const locale of FRONTEND_LOCALES) assert.notEqual(num(1234, 0, locale), '—');
});
