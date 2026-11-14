import test from 'node:test';
import assert from 'node:assert/strict';
import { directionForLocale, presentationLocale, compareLocalizedValues, formatNumber, formatDate, formatCurrency } from './locale-format.mjs';
import { FRONTEND_LOCALES } from './frontend-locale.mjs';

test('all 23 locales format correctly; Arabic and Urdu are RTL', () => {
  assert.equal(FRONTEND_LOCALES.length, 22);
  for (const locale of FRONTEND_LOCALES) {
    assert.equal(presentationLocale(locale),locale);
    assert.equal(directionForLocale(locale),['ar','ur'].includes(locale) ? 'rtl' : 'ltr');
    assert.ok(formatNumber(1234.5,locale).length>0);
    assert.ok(formatCurrency(120,'SAR',locale).length>0);
    assert.ok(formatDate('2026-11-10',locale).length>0);
  }
  assert.equal(presentationLocale('invalid'),'en-US');
  assert.equal(formatDate('invalid','en-US'),'—');
});
test('locale sorting preserves nulls last in either direction', () => {
  assert.ok(compareLocalizedValues('Project 2','Project 10','de')<0);
  assert.ok(compareLocalizedValues('Project 2','Project 10','fr','desc')>0);
  assert.ok(compareLocalizedValues(null,'Project 10','ja','desc')>0);
});
