import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRONTEND_LOCALES } from '../apps/web/src/lib/frontend-locale.mjs';
import { UI_LABELS, uiLabel, catalogLocale, translationHasMatchingPlaceholders } from '../apps/web/src/lib/ui-labels.mjs';
import { directionForLocale } from '../apps/web/src/lib/locale-format.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const LABELS = [
  'Work Board',
  'Day-to-day work across the portfolio, by workflow state. Use the arrows on a card to move it — every move is recorded in the audit trail.',
  'No tasks yet.', 'Work board snapshot', 'TASK DELIVERY', 'Status of returned tasks',
  'These figures count tasks returned by this API response, not necessarily every task across the workspace.',
  'Returned tasks', 'Blocked tasks', 'Completed tasks', 'To do', 'In progress',
  'Blocked', 'Done', 'unassigned', 'due', 'Move to {state}',
  'Move {task} to {state}', '{count} tasks',
];

test('board module supplies every visible and assistive label in all 23 locale variants', () => {
  assert.equal(FRONTEND_LOCALES.length, 23);
  for (const key of LABELS) {
    for (const locale of FRONTEND_LOCALES) {
      const value = uiLabel(key, locale);
      assert.ok(value && value.trim(), locale + ': empty ' + key);
      assert.ok(translationHasMatchingPlaceholders(key, value), locale + ': broken placeholders ' + key);
      if (!locale.startsWith('en-')) {
        const explicit = UI_LABELS[key]?.[catalogLocale(locale)];
        assert.equal(value, explicit, locale + ': missing ' + key);
        assert.notEqual(value, key, locale + ': English fallback ' + key);
      }
    }
  }
});

test('board movement keeps the audited form POST, isolates user content and exposes localized accessible controls', () => {
  const page = read('apps/web/src/app/(app)/board/page.tsx');
  for (const x of ["method=\"post\" action=\"/api/govern\"",
    'name="intent" value="task"', 'name="id"', 'name="state"',
    'name="returnTo" value="/board"', '<bdi>{t.title}</bdi>',
    '<bdi>{t.projectCode}</bdi>', "tx('No tasks yet.')",
    "tx('Work board snapshot')", "tx('Returned tasks')",
    "tx('Blocked tasks')", "tx('Completed tasks')",
    "tx('{count} tasks')", "t('Move to {state}')",
    "t('Move {task} to {state}')", 'aria-label={accessibleLabel}',
    "directionForLocale(locale) === 'rtl'", 'formatNumber(col.length, locale)',
    'const tx = await tr()', 't={tx} taskTitle={t.title}',
    'when(t.dueDate, locale)']) {
    assert.ok(page.includes(x), x);
  }
  assert.doesNotMatch(page, /lang === 'ar' \?/, 'no English/Arabic-only workflow labels');
  assert.doesNotMatch(page, /t\(prev\[1\]\)|t\(next\[1\]\)/, 'do not mistake task object for translator');
  for (const code of ['ar','ur']) assert.equal(directionForLocale(code), 'rtl');
  for (const code of ['en-US','de','es-419','zh-TW']) assert.equal(directionForLocale(code), 'ltr');
});

test('task count and movement templates retain slots without translating arbitrary task titles', () => {
  for (const locale of FRONTEND_LOCALES) {
    const move = uiLabel('Move {task} to {state}', locale);
    assert.ok(move.includes('{task}') && move.includes('{state}'), locale);
    const rendered = move.replace('{task}', 'TASK-22: مراجعة').replace('{state}', uiLabel('In progress', locale));
    assert.ok(rendered.includes('TASK-22: مراجعة'), locale);
    assert.ok(!rendered.includes('{state}'), locale);
    const count = uiLabel('{count} tasks', locale).replace('{count}', '12');
    assert.ok(count.includes('12'), locale);
  }
});
