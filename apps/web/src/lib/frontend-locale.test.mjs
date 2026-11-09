import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRONTEND_LOCALES,
  normalizeFrontendLocale,
  chooseFrontendLocale,
  isSupportedFrontendLocale,
} from './frontend-locale.mjs';

test('defines the six approved frontend locales only', () => {
  assert.deepEqual([...FRONTEND_LOCALES], [
    'en', 'ar-SA', 'de-DE', 'zh-CN', 'fr-FR', 'ja-JP',
  ]);
  assert.equal(isSupportedFrontendLocale('ar-SA'), true);
  assert.equal(isSupportedFrontendLocale('es'), false);
});

test('normalizes language subtags while preserving script distinctions', () => {
  assert.equal(normalizeFrontendLocale('en-US'), 'en');
  assert.equal(normalizeFrontendLocale('ar-SA'), 'ar-SA');
  assert.equal(normalizeFrontendLocale('de-CH'), 'de-DE');
  assert.equal(normalizeFrontendLocale('fr-CA'), 'fr-FR');
  assert.equal(normalizeFrontendLocale('ja-JP'), 'ja-JP');
  assert.equal(normalizeFrontendLocale('zh-Hans'), 'zh-CN');
  assert.equal(normalizeFrontendLocale('zh-SG'), 'zh-CN');
  assert.equal(normalizeFrontendLocale('zh-TW'), null);
  assert.equal(normalizeFrontendLocale('zh-HK'), null);
  assert.equal(normalizeFrontendLocale('pt-BR'), null);
  assert.equal(normalizeFrontendLocale(null), null);
});

test('explicit user choice wins over browser and IP country', () => {
  assert.equal(chooseFrontendLocale({
    selected: 'en', saved: 'ar', browserLanguages: ['de-DE'], country: 'SA',
  }), 'en');
});

test('saved preference takes precedence over browser and country', () => {
  assert.equal(chooseFrontendLocale({
    saved: 'ja-JP', browserLanguages: ['ar-SA'], country: 'CN',
  }), 'ja-JP');
});

test('browser language takes precedence over regional IP hint', () => {
  assert.equal(chooseFrontendLocale({
    browserLanguages: ['es-ES', 'fr-CA', 'en-US'], country: 'CN',
  }), 'fr-FR');
});

test('country acts as fallback only, never as forced language', () => {
  assert.equal(chooseFrontendLocale({ country: 'CN' }), 'zh-CN');
  assert.equal(chooseFrontendLocale({ country: 'SA' }), 'ar-SA');
  assert.equal(chooseFrontendLocale({ country: 'DE' }), 'de-DE');
  assert.equal(chooseFrontendLocale({ country: 'JP' }), 'ja-JP');
  assert.equal(chooseFrontendLocale({ browserLanguages: ['en-US'], country: 'SA' }), 'en');
});

test('unsupported language and missing country safely fall back to English', () => {
  assert.equal(chooseFrontendLocale(), 'en');
  assert.equal(chooseFrontendLocale({ selected: 'xx', saved: 'pt', browserLanguages: ['es'], country: 'US' }), 'en');
  assert.equal(chooseFrontendLocale({ selected: 'zh-TW', country: 'JP' }), 'ja-JP');
});
