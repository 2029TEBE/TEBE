import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFrontendLocale } from '../apps/web/src/lib/frontend-locale.mjs';
import { resolveLocale } from '../packages/contracts/src/locales.ts';

test('frontend and shared contracts resolve all supported regional aliases consistently', () => {
  const aliases = [
    'en', 'en-GB', 'en-GB-u-ca-gregory', 'en-US-u-nu-latn',
    'es-419', 'es-419-u-nu-latn',
    'pt-BR', 'pt-BR-u-nu-latn', 'pt-PT-u-ca-gregory',
    'ar-SA', 'zh', 'zh-Hant', 'zh-Hant-HK', 'zh-Hans-SG',
    'zh-TW-u-ca-gregory', 'zh-HK-u-nu-hanidec', 'zh-MO',
    'zh-CN-u-nu-latn', 'zh-SG-u-ca-gregory',
  ];
  for (const input of aliases) {
    assert.equal(resolveLocale(input), normalizeFrontendLocale(input), input);
  }
});
