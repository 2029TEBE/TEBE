/** Dependency-free smoke check for The EPMO bilingual application shell.
 * This is static validation, NOT a replacement for browser or build tests. */
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const layout = read('apps/web/src/app/layout.tsx');
const language = read('apps/web/src/lib/i18n.ts');
const toggle = read('apps/web/src/components/UniversalLocaleSwitch.tsx');
const login = read('apps/web/src/app/login/page.tsx');
const checks = [
  ['English/Arabic page metadata', layout.includes('The EPMO | المكتب التنفيذي لإدارة المشاريع')],
  ['Correct document lang and direction', layout.includes("<html lang={locale} dir={ar ? 'rtl' : 'ltr'}") && layout.includes("const ar = locale === 'ar' || locale === 'ur'")],
  ['Cookie-backed language preference', language.includes("get('pmo_lang')") && language.includes("get('pmo_locale')")],
  ['Language selector persists both preferences', toggle.includes('document.cookie = `pmo_lang=') && toggle.includes('document.cookie = `pmo_locale=')],
  ['Language selector refreshes server UI', toggle.includes('router.refresh()')],
  ['Language selector has accessible name', toggle.includes('aria-label=') && toggle.includes('<select id=')],
  ['Bilingual login headline', login.includes("ar ? 'تسجيل الدخول' : 'Sign in'")],
  ['Bilingual login help', login.includes("ar ? 'حسابات التطوير' : 'Development accounts'")],
  ['Arabic login panel copy', login.includes('لا يمكن للمشروع تجاوز بوابة حوكمة')],
  ['Bilingual product wordmark', login.includes("ar ? 'المكتب التنفيذي لإدارة المشاريع' : 'The EPMO'")],
];
let failed = 0;
for (const [name, pass] of checks) {
  process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${name}\n`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} static bilingual checks passed`);
if (failed) process.exitCode = 1;
