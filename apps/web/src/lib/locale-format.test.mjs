import test from 'node:test';
import assert from 'node:assert/strict';
import { directionForLocale, presentationLocale, compareLocalizedValues, formatNumber, formatDate, formatCurrency } from './locale-format.mjs';

test('approved locales resolve; Arabic is the only RTL locale', () => {
  for (const locale of ['en', 'ar-SA', 'de-DE', 'zh-CN', 'fr-FR', 'ja-JP'])
    assert.equal(presentationLocale(locale), locale);
  assert.equal(directionForLocale('ar-SA'), 'rtl');
  for (const locale of ['en', 'de-DE', 'zh-CN', 'fr-FR', 'ja-JP'])
    assert.equal(directionForLocale(locale), 'ltr');
  assert.equal(presentationLocale('zh-TW'), 'en');
});

test('locale-aware numeric sorting preserves nulls last in both directions', () => {
  assert.ok(compareLocalizedValues('Project 2', 'Project 10', 'de-DE') < 0);
  assert.ok(compareLocalizedValues('Project 2', 'Project 10', 'fr-FR', 'desc') > 0);
  assert.ok(compareLocalizedValues(null, 'Project 10', 'ja-JP', 'desc') > 0);
});
test('formats numbers, currencies and dates with Intl for each approved locale', () => {
  for (const locale of ['en', 'ar-SA', 'de-DE', 'zh-CN', 'fr-FR', 'ja-JP']) {
    assert.ok(formatNumber(1234.5, locale).length > 0);
    assert.ok(formatCurrency(120, 'SAR', locale).length > 0);
    assert.ok(formatDate('2026-11-10', locale).length > 0);
  }
  assert.equal(formatDate('invalid', 'en'), '—');
});
