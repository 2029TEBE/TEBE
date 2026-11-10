import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('core migrated frontend files do not embed Arabic presentation strings', () => {
  const paths = [
    'apps/web/src/app/login/page.tsx',
    'apps/web/src/components/Crumbs.tsx',
    'apps/web/src/components/ThemeToggle.tsx',
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
