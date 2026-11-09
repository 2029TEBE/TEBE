import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const switcher = read('apps/web/src/components/LangToggle.tsx');
const root = read('apps/web/src/app/layout.tsx');
const app = read('apps/web/src/app/(app)/layout.tsx');
const login = read('apps/web/src/app/login/page.tsx');
const css = read('apps/web/src/app/globals.css');
const webLocale = read('apps/web/src/lib/i18n.ts');
test('dashboard and sign-in page both offer the universal locale selector',()=>{
  assert.match(app,/LangToggle locale=\{locale\}/);
  assert.match(login,/LangToggle locale=\{locale\}/);
  assert.match(switcher,/SUPPORTED_LOCALES\.map/);
  assert.match(switcher,/aria-label="Interface language"/);
});
test('selector validates locale and persists preference without modifying sessions',()=>{
  assert.match(switcher,/SUPPORTED_LOCALES\.some/);
  assert.match(switcher,/pmo_lang=/);
  assert.match(switcher,/window\.location\.reload\(\)/);
  assert.doesNotMatch(switcher,/SESSION_COOKIE|tenantId|switch-tenant|auth\.logout/);
});
test('shared locale detection keeps fallback to English on untranslated pages',()=>{
  assert.match(webLocale,/resolveRequestLocale\(/);
  assert.match(webLocale,/=== 'ar-SA' \? 'ar' : 'en'/);
  assert.match(root,/data-selected-locale=\{locale\}/);
  assert.match(root,/lang=\{ar \? 'ar-SA' : 'en'\}/);
});
test('Arabic direction and font are consistent at document and dashboard level',()=>{
  assert.match(root,/dir=\{ar \? 'rtl' : 'ltr'\}/);
  assert.match(app,/dir=\{ar \? 'rtl' : 'ltr'\}/);
  assert.match(css,/html\[lang='ar-SA'\]/);
});
