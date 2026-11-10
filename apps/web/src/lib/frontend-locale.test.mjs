import test from 'node:test';
import assert from 'node:assert/strict';
import { FRONTEND_LOCALES, normalizeFrontendLocale, chooseFrontendLocale, isSupportedFrontendLocale } from './frontend-locale.mjs';

test('registers 23 TheOrg variants and keeps 19 language families', () => {
  assert.equal(FRONTEND_LOCALES.length, 23);
  assert.equal(new Set(FRONTEND_LOCALES.map(s => s.split('-')[0])).size, 19);
  assert.equal(isSupportedFrontendLocale('ur'), true);
  assert.equal(isSupportedFrontendLocale('es-419'), true);
  assert.equal(isSupportedFrontendLocale('xx'), false);
});

test('retains exact Chinese scripts and regional English variants', () => {
  assert.equal(normalizeFrontendLocale('en-GB'), 'en-GB');
  assert.equal(normalizeFrontendLocale('en-US'), 'en-US');
  assert.equal(normalizeFrontendLocale('ar-SA'), 'ar');
  assert.equal(normalizeFrontendLocale('zh-Hant'), 'zh-TW');
  assert.equal(normalizeFrontendLocale('zh-Hans'), 'zh-CN');
  assert.equal(normalizeFrontendLocale('zh-HK'), 'zh-TW');
  assert.equal(normalizeFrontendLocale('pt-PT'), 'pt-PT');
});

test('user-selected or saved preference wins', () => {
  assert.equal(chooseFrontendLocale({selected:'ur',saved:'fr',browserLanguages:['en-GB']}),'ur');
  assert.equal(chooseFrontendLocale({saved:'ja',browserLanguages:['de']}),'ja');
});

test('browser preference precedes country hints; unknown defaults to English', () => {
  assert.equal(chooseFrontendLocale({browserLanguages:['es-419'],country:'CN'}),'es-419');
  assert.equal(chooseFrontendLocale({country:'SA'}),'ar');
  assert.equal(chooseFrontendLocale({country:'JP'}),'ja');
  assert.equal(chooseFrontendLocale({selected:'invalid',saved:'invalid'}),'en-US');
});

test('preserves supported regional variants with browser extension subtags', () => {
  assert.equal(normalizeFrontendLocale('en-GB-oxendict'), 'en-GB');
  assert.equal(normalizeFrontendLocale('en-GB-u-ca-gregory'), 'en-GB');
  assert.equal(normalizeFrontendLocale('es-419-u-nu-latn'), 'es-419');
  assert.equal(normalizeFrontendLocale('pt-BR-u-nu-latn'), 'pt-BR');
  assert.equal(normalizeFrontendLocale('pt-PT-u-ca-gregory'), 'pt-PT');
  assert.equal(chooseFrontendLocale({browserLanguages:['en-GB-u-ca-gregory']}), 'en-GB');
});

test('Chinese region and script extensions retain the intended writing system', () => {
  for (const value of ['zh-TW-u-ca-gregory', 'zh-HK-u-nu-hanidec', 'zh-MO', 'zh-Hant-HK']) {
    assert.equal(normalizeFrontendLocale(value), 'zh-TW', value);
  }
  for (const value of ['zh-CN-u-nu-latn', 'zh-SG-u-ca-gregory', 'zh-Hans-SG']) {
    assert.equal(normalizeFrontendLocale(value), 'zh-CN', value);
  }
  assert.equal(chooseFrontendLocale({browserLanguages:['zh-TW-u-ca-gregory']}), 'zh-TW');
});
