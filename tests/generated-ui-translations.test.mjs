import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UI_TRANSLATIONS, COMPLETE_UI_LOCALES } from '../apps/web/src/lib/generated-translations.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const keys=JSON.parse(read('translation-source.json'));
const report=JSON.parse(read('translation-coverage.json'));
test('coverage accurately identifies incomplete locales without counting fallback',()=>{
  assert.equal(Object.keys(UI_TRANSLATIONS).length,21);
  for(const [locale,copy]of Object.entries(UI_TRANSLATIONS)){
    const missing=keys.filter(k=>!Object.hasOwn(copy,k));
    assert.deepEqual(report[locale].missing,missing);
    assert.equal(report[locale].translated,keys.length-missing.length);
    assert.equal(COMPLETE_UI_LOCALES.includes(locale),missing.length===0);
  }
});
test('server/API and frontend use identical generated static copy',()=>{
  const source=read('packages/contracts/src/generated-translations.ts');
  const data=JSON.parse(source.slice(source.indexOf(' = ')+3,source.lastIndexOf(';')));
  assert.deepEqual(data,UI_TRANSLATIONS);
});
test('locale context translates only explicitly marked copy and preserves form values',()=>{
  const source=read('apps/web/src/components/UiLocale.tsx');
  assert.match(source,/for \(const key of copy\)/);
  assert.doesNotMatch(source,/MutationObserver|querySelectorAll|innerHTML|fetch\(/);
  assert.match(read('apps/web/src/app/layout.tsx'),/UiLocaleProvider locale=\{locale\}/);
});
