import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocale, localeDirection, SUPPORTED_LOCALES, DEFAULT_LOCALE, selectRequestLocale } from '../../../../packages/contracts/src/locales.ts';
import { readFileSync } from 'node:fs';

test('the agreed six locales are stable and English is the master', () => {
  assert.deepEqual([...SUPPORTED_LOCALES], ['en','ar-SA','de-DE','zh-CN','fr-FR','ja-JP']);
  assert.equal(DEFAULT_LOCALE, 'en');
  for (const locale of SUPPORTED_LOCALES) {
    assert.equal(normalizeLocale(locale), locale);
    assert.equal(localeDirection(locale), locale === 'ar-SA' ? 'rtl' : 'ltr');
  }
});
test('legacy language cookies map to canonical locale codes', () => {
  assert.equal(normalizeLocale('ar'), 'ar-SA');
  assert.equal(normalizeLocale('EN'), 'en');
  assert.equal(normalizeLocale('de-de'), 'de-DE');
  assert.equal(normalizeLocale('fr_CA'), 'fr-FR');
  assert.equal(normalizeLocale('zh-Hans'), 'zh-CN');
  assert.equal(normalizeLocale('ja-JP'), 'ja-JP');
  assert.equal(normalizeLocale('zh-TW'), null);
});
test('cookie choice wins over Accept-Language and stays request scoped', () => {
  assert.equal(selectRequestLocale('ar', 'en-US,en;q=0.8'), 'ar-SA');
  assert.equal(selectRequestLocale('ja-JP', 'ar-SA;q=1'), 'ja-JP');
});
test('malformed cookie falls back to weighted Accept-Language', () => {
  assert.equal(selectRequestLocale('unknown', 'fr-FR;q=0.4,de-DE;q=0.9,ar-SA;q=0'), 'de-DE');
  assert.equal(selectRequestLocale(undefined, 'zh-Hans-CN,ja;q=0.6'), 'zh-CN');
  assert.equal(selectRequestLocale(undefined, 'xx-XX;q=1,ar;q=0.5'), 'ar-SA');
});
test('unsupported, disabled or malformed language preferences fall back to English', () => {
  assert.equal(selectRequestLocale(undefined, '*;q=1,es-ES;q=0.7'), 'en');
  assert.equal(selectRequestLocale(undefined, 'ar;q=0'), 'en');
  assert.equal(selectRequestLocale(undefined, 'ar;q=2'), 'en');
  assert.equal(selectRequestLocale(''.padEnd(600, 'a'), ''.padEnd(600, 'a')), 'en');
});
test('API middleware is strictly request-scoped and wired after cookie parsing', () => {
  const source = readFileSync(new URL('./request-locale.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
  assert.match(source, /res\.locals\.epmoLocale\s*=\s*selectRequestLocale\(/);
  assert.doesNotMatch(source, /res\.cookie\(|setHeader\(|tenantId\s*=/);
  assert.ok(main.indexOf('app.use(cookieParser());') < main.indexOf('app.use(requestLocaleMiddleware);'));
});
