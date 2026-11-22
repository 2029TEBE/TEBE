import test from 'node:test';
import assert from 'node:assert/strict';
import { FRONTEND_LOCALES } from './frontend-locale.mjs';
import { money, num, pct, when, ago } from './presentation-values.mjs';

test('all 23 supported variants format dates, amounts and percentages using their locale', () => {
  assert.equal(FRONTEND_LOCALES.length, 23);
  const stamp = '2026-11-22T12:00:00Z';
  for (const locale of FRONTEND_LOCALES) {
    const values = [money(123456.7, locale), num(1234.5, 1, locale),
      pct(42.8, locale), when(stamp, locale), ago(stamp, locale)];
    for (const value of values) assert.ok(typeof value === 'string' && value.trim(), locale);
    assert.ok(values[2].includes('%'), locale);
    assert.notEqual(values[3], '—', locale);
  }
});
test('source data with invalid or nonfinite numeric and date fields is not presented as real data', () => {
  assert.equal(money(NaN, 'de'), '—');
  assert.equal(money(Infinity, 'ur'), '—');
  assert.equal(num(-Infinity, 2, 'ja'), '—');
  assert.equal(pct(NaN, 'pt-BR'), '—');
  assert.equal(when('invalid-date', 'zh-TW'), '—');
  assert.equal(ago('invalid-date', 'ar'), '—');
  assert.equal(when(null, 'fr'), '—');
});
test('legacy English default and selected English variants retain deliberate regional formatting', () => {
  const stamp = '2026-11-22T12:00:00Z';
  assert.equal(when(stamp), when(stamp, 'en-GB'));
  assert.notEqual(when(stamp, 'en-GB'), when(stamp, 'en-US'));
  assert.equal(pct(47.6), '48%');
  assert.equal(money(1200), '1.2K');
});
test('Arabic business dates use Gregorian calendar with Latin digits and Urdu is not English-only', () => {
  assert.match(when('2026-11-22T12:00:00Z','ar'), /[0-9]/);
  assert.notEqual(when('2026-11-22T12:00:00Z','ur'),when('2026-11-22T12:00:00Z','en-GB'));
});
