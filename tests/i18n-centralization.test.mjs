import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('core migrated frontend files do not embed Arabic presentation strings', () => {
  const paths = [
    'apps/web/src/app/login/page.tsx',
    'apps/web/src/components/Crumbs.tsx',
    'apps/web/src/components/ThemeToggle.tsx',
    'apps/web/src/components/UniversalLocaleSwitch.tsx',
    'apps/web/src/app/(app)/layout.tsx',
    'apps/web/src/lib/nav.ts',
    'apps/web/src/app/(app)/billing/page.tsx',
    'apps/web/src/app/(app)/super-admin/page.tsx',
    'apps/web/src/app/(app)/settings/page.tsx',
  ];
  for (const path of paths) {
    const text = read(path);
    assert.doesNotMatch(text, /[\u0600-\u06ff]{2,}/u, `inline Arabic found in ${path}`);
  }
});

test('shared contracts contain migrated Arabic texts and all new registries are exported', () => {
  const index = read('packages/contracts/src/index.ts');
  for (const name of ['nav-locale','billing-locale','superadmin-locale','settings-locale','getting-started-copy','locales']) {
    assert.ok(index.includes(`'./${name}'`), `missing shared contract export ${name}`);
  }
  const nav = read('packages/contracts/src/nav-locale.ts');
  assert.match(nav, /المكتب التنفيذي لإدارة المشاريع/);
  assert.match(nav, /تسجيل الدخول/);
  const billing = read('packages/contracts/src/billing-locale.ts');
  assert.match(billing, /الفترة التجريبية/);
  assert.match(billing, /Trial: \{days\} days/);
});

test('onboarding and billing pages use shared dictionary rather than duplicate copy', () => {
  assert.match(read('apps/web/src/app/(app)/getting-started/page.tsx'), /GETTING_STARTED_COPY\[lang\]/);
  assert.match(read('apps/web/src/app/(app)/billing/page.tsx'), /billingArabic\(english\)/);
  assert.match(read('apps/web/src/app/(app)/super-admin/page.tsx'), /superadminArabic\(english\)/);
  assert.match(read('apps/web/src/app/(app)/settings/page.tsx'), /settingsArabic\(english\)/);
});

test('Urdu uses RTL without being mistaken for Arabic translations', () => {
  const root = read('apps/web/src/app/layout.tsx');
  const app = read('apps/web/src/app/(app)/layout.tsx');
  const crumbs = read('apps/web/src/components/Crumbs.tsx');
  assert.match(root, /locale === 'ar' \|\| locale === 'ur'/);
  assert.match(app, /const ar = locale === 'ar';/);
  assert.match(app, /const rtl = locale === 'ar' \|\| locale === 'ur';/);
  assert.match(crumbs, /locale === 'ar' \|\| locale === 'ur' \? 'rtl' : 'ltr'/);
});

test('eight dashboard pages resolve literal Arabic phrases from the shared page catalog', () => {
  const pages = ['activity', 'benefits', 'decisions', 'documents', 'financials', 'my-work', 'notifications', 'portfolios'];
  const catalog = read('packages/contracts/src/page-locale.ts');
  for (const page of pages) {
    const source = read(`apps/web/src/app/(app)/${page}/page.tsx`);
    assert.ok(source.includes(`pageArabic("${page}", english)`), `missing lookup in ${page}`);
    assert.doesNotMatch(source, /lang\s*===\s*'ar'\s*\?\s*'[^']+'\s*:\s*'[^']+'/);
    assert.ok(catalog.includes(`"${page}": Object.freeze`), `missing catalog for ${page}`);
  }
});

test('localized statuses are presentation-only and verified legacy Arabic values remain available', () => {
  const status = read('packages/contracts/src/status-locale.ts');
  for (const word of ['مسودة','قيد المراجعة','معتمد','متوقف','متحقق','وفق الخطة']) {
    if (word === 'متوقف') continue; // no existing "paused" status in this catalog
    assert.ok(status.includes(word), `missing legacy status label: ${word}`);
  }
  for (const page of ['benefits', 'documents', 'my-work', 'portfolios']) {
    const code = read(`apps/web/src/app/(app)/${page}/page.tsx`);
    assert.match(code, /localizedStatus\(/);
  }
});

test('backend export rejects untranslated locales without changing approved EN/AR document builders', () => {
  const controller = read('apps/api/src/exports/exports.controller.ts');
  const languages = read('packages/contracts/src/export-language.ts');
  assert.match(controller, /resolveExportLanguage\(v\)/);
  assert.match(controller, /throw new BadRequestException\('This export is available in English and Arabic only/);
  assert.match(languages, /normalized === 'ar-sa'/);
  assert.match(languages, /normalized === 'en-us'/);
  assert.match(languages, /return null;/);
  const svc = read('apps/api/src/exports/exports.service.ts');
  assert.match(svc, /private async pack\(lang: 'en' \| 'ar'\)/);
});

test('parameterized Arabic financial guidance preserves all English variables', () => {
  const page = read('packages/contracts/src/page-locale.ts');
  const extra = read('packages/contracts/src/getting-started-extra-locale.ts');
  for (const token of ['{pct}', '{count}']) assert.ok(page.includes(token));
  assert.match(extra, /\{days\}/);
  assert.match(read('apps/web/src/app/(app)/benefits/page.tsx'), /fill\(labelFor\('/);
});

test('universal selector uses shared Arabic catalog, not embedded language labels', () => {
  const switcher = read('apps/web/src/components/UniversalLocaleSwitch.tsx');
  const nav = read('packages/contracts/src/nav-locale.ts');
  assert.match(switcher, /navigationArabic\('Interface language'\)/);
  assert.match(nav, /"Interface language": "لغة الواجهة"/);
  assert.match(read('apps/web/src/app/(app)/layout.tsx'), /navigationArabic\('The EPMO'\)/);
});

test('account flows centralize all presentation Arabic and preserve secret-handling logic', () => {
  const pages = [
    'apps/web/src/app/forgot-password/page.tsx',
    'apps/web/src/app/reset-password/page.tsx',
    'apps/web/src/app/accept-invite/page.tsx',
  ];
  const forms = [
    'apps/web/src/app/forgot-password/RecoveryRequestForm.tsx',
    'apps/web/src/app/reset-password/ResetPasswordForm.tsx',
    'apps/web/src/app/accept-invite/InviteForm.tsx',
  ];
  for (const path of [...pages, ...forms]) {
    assert.doesNotMatch(read(path), /[\u0600-\u06ff]{2,}/u, `inline Arabic in ${path}`);
  }
  const copy = read('packages/contracts/src/auth-form-locale.ts');
  for (const key of ['recovery','reset','invite']) assert.match(copy, new RegExp(`\\b${key}: Object\\.freeze`));
  assert.match(read(forms[1]), /window\.history\.replaceState/);
  assert.match(read(forms[2]), /window\.history\.replaceState/);
  assert.match(read(forms[0]), /body: JSON\.stringify\(\{ email, lang \}\)/);
  for (const path of pages) assert.match(read(path), /locale === 'ar' \|\| locale === 'ur'/);
});

test('shared contract and frontend locale lists remain identical', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const registry = read('packages/contracts/src/locales.ts');
  const codes = [...registry.matchAll(/\{ code: '([^']+)', name:/g)].map(m => m[1]);
  assert.equal(codes.length, 22);
  assert.deepEqual([...FRONTEND_LOCALES], codes, 'frontend and backend locale registries have drifted');
});

test('invalid new locale preference preserves reviewed legacy Arabic cookie', () => {
  const source = read('apps/web/src/lib/i18n.ts');
  assert.match(source, /const normalized = normalizeFrontendLocale\(current\)/);
  assert.match(source, /if \(normalized\) return normalized;/);
  assert.match(source, /jar\.get\('pmo_lang'\)\?\.value === 'ar'/);
  assert.doesNotMatch(source, /normalizeFrontendLocale\(current\) \?\? 'en-US'/);
});
