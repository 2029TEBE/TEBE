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

test('Spanish interpolation gaps are genuinely translated and preserve parameters', () => {
  const cases = [
    'Showing the first {shown} of {total} projects needing review.',
    'The blocker is: {reason}.',
    'Trial time remaining: {days} days. Finish workspace setup and review your plan before the trial ends.',
    'Trial: {days} days',
  ];
  const params = value => [...value.matchAll(/\\{([a-zA-Z][\\w]*)\\}/g)].map(m => m[1]).sort();
  for (const key of cases) {
    assert.equal(typeof UI_TRANSLATIONS.es[key], 'string');
    assert.notEqual(UI_TRANSLATIONS.es[key], key);
    assert.deepEqual(params(UI_TRANSLATIONS.es[key]), params(key), key);
  }
});

test('regional language variants cover the static inventory (regional copy still needs review)', () => {
  for (const locale of ['es', 'es-419', 'pt-BR', 'pt-PT']) {
    assert.deepEqual(report[locale].missing, [], `${locale}: expected inventory-complete catalog`);
  }
  assert.equal(UI_TRANSLATIONS['es-419']['Human confirmation required'],
    UI_TRANSLATIONS.es['Human confirmation required']);
  assert.equal(UI_TRANSLATIONS['pt-PT']['Human confirmation required'],
    UI_TRANSLATIONS['pt-BR']['Human confirmation required']);
  assert.ok(report.sw.missing.length > 0, 'do not treat still-untranslated locales as complete');
});
