import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_LOCALES, DEFAULT_LOCALE, normalizeLocale, localeFromAcceptLanguage,
  resolveRequestLocale, localeDirection,
} from './locales.ts';

test('exact six canonical locales, English default and only Arabic RTL', () => {
  assert.deepEqual(SUPPORTED_LOCALES.map(entry => entry.code),
    ['en','ar-SA','de-DE','zh-CN','fr-FR','ja-JP']);
  assert.equal(DEFAULT_LOCALE,'en');
  assert.deepEqual(SUPPORTED_LOCALES.filter(entry => entry.direction === 'rtl').map(entry => entry.code), ['ar-SA']);
  for (const locale of SUPPORTED_LOCALES) {
    assert.equal(localeDirection(locale.code), locale.direction);
  }
});
test('legacy Arabic cookie and safe language aliases normalize to canonical codes', () => {
  assert.equal(normalizeLocale('ar'), 'ar-SA');
  assert.equal(normalizeLocale('ar-SA'), 'ar-SA');
  assert.equal(normalizeLocale('zh-Hans'), 'zh-CN');
  assert.equal(normalizeLocale('DE-de'), 'de-DE');
  assert.equal(normalizeLocale('fr'), 'fr-FR');
  assert.equal(normalizeLocale('ja-JP'), 'ja-JP');
});
test('unsupported or malicious language tags never escape the allowlist', () => {
  for (const locale of ['xx-XX','zh-TW','../../etc/passwd','__proto__','constructor','toString','', 'a'.repeat(120), {}, null]) {
    assert.equal(normalizeLocale(locale), null);
  }
});
test('explicit switcher beats cookie, which beats weighted Accept-Language', () => {
  assert.equal(resolveRequestLocale('ja-JP','ar','de-DE,de;q=0.8'), 'ja-JP');
  assert.equal(resolveRequestLocale('xx','ar','fr-FR,ja;q=0.3'), 'ar-SA');
  assert.equal(resolveRequestLocale(undefined, undefined, 'fr-FR;q=0.4,de-DE;q=0.9'), 'de-DE');
  assert.equal(resolveRequestLocale(undefined,undefined,'xx-XX'), 'en');
});
test('Accept-Language quality 0 is ignored; invalid q cannot force locale', () => {
  assert.equal(localeFromAcceptLanguage('ar-SA;q=0,ja-JP;q=0.5'), 'ja-JP');
  assert.equal(localeFromAcceptLanguage('ar-SA;q=1.2,en;q=0.5'), 'en');
  assert.equal(localeFromAcceptLanguage('de-DE,fr-FR;q=0.8'), 'de-DE');
  assert.equal(localeFromAcceptLanguage('ar-SA;q=0'), null);
  assert.equal(localeFromAcceptLanguage('a'.repeat(513)), null);
});
