import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareTableValues, formatTableCount } from '../apps/web/src/lib/table-locale.mjs';
import { uiLabel } from '../apps/web/src/lib/ui-labels.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('numerical sorting uses numeric values', () => {
  assert.ok(compareTableValues(2, 10, 'en', 'asc') < 0);
  assert.ok(compareTableValues(2, 10, 'en', 'desc') > 0);
});
test('natural sort handles text with embedded project numbers', () => {
  assert.ok(compareTableValues('PRJ-2', 'PRJ-10', 'en') < 0);
});
test('both languages sort alphabetic strings with locale collators', () => {
  assert.equal(compareTableValues('Same', 'same', 'en'), 0);
  assert.ok(compareTableValues('أ', 'ب', 'ar') < 0);
});
test('empty values stay at the bottom in both directions', () => {
  for (const dir of ['asc', 'desc']) {
    assert.ok(compareTableValues(null, 'أحمد', 'ar', dir) > 0);
    assert.ok(compareTableValues('أحمد', null, 'ar', dir) < 0);
    assert.equal(compareTableValues(null, null, 'en', dir), 0);
  }
});
test('English counts have Western digits and Arabic counts have Arabic numbering', () => {
  assert.equal(formatTableCount(1234, 'en'), '1,234');
  assert.match(formatTableCount(1234, 'ar'), /[٠-٩]/);
});
test('mobile navigation supports locale and route-aware closing', () => {
  const s = read('apps/web/src/components/MobileNav.tsx');
  assert.match(s, /uiLabel\(label, selectedLocale, legacy\(label\)\)/);
  assert.match(s, /aria-label=\{t\('Open navigation'\)\}/);
  assert.match(s, /aria-label=\{t\('Close navigation'\)\}/);
  assert.match(s, /aria-expanded=\{open\}/);
  assert.match(s, /e\.key === 'Escape'/);
  assert.match(s, /previousPath\.current !== path/);
  assert.match(s, /closest\('a\[href\]'\)/);
});
test('navigation passes selected locale and translates command groups', () => {
  const s = read('apps/web/src/app/(app)/layout.tsx');
  assert.match(s, /<MobileNav ar=\{ar\} locale=\{locale\}>/);
  // The nav label is translated through the frontend-only catalog, preserving
  // Arabic names and stable links instead of branching on language at each use.
  assert.ok(s.includes('group: uiLabel(g.label, locale, navigationArabic(g.label))'));
  assert.ok(s.includes('label: uiLabel(i.label, locale, navigationArabic(i.label))'));
  // Assert actual fallback behavior, not implementation syntax.
  assert.equal(uiLabel('Projects', 'ar', 'المشاريع'), 'المشاريع');
  assert.equal(uiLabel('Projects', 'de'), 'Projekte');
  assert.equal(uiLabel('Untranslated label', 'de'), 'Untranslated label');
  assert.equal(uiLabel('Value {count}', 'ar', 'القيمة {missing}'), 'Value {count}');
  assert.match(s, /const commands = groups\.flatMap/);
});
test('tables use locale helpers and bidi isolation for raw values', () => {
  const s = read('apps/web/src/components/DataTable.tsx');
  assert.match(s, /compareTableValues\(x, y, locale, sort\.dir\)/);
  assert.match(s, /formatTableCount\(rows\.length, locale\)/);
  assert.match(s, /<bdi>/);
  assert.match(s, /aria-sort=\{can \?/);
});
test('localized chrome translations exist', () => {
  const s = read('packages/contracts/src/i18n.ts');
  for (const key of ["'Close navigation':", "'capabilities':", "'current':"]) {
    assert.ok(s.includes(key), `missing translation ${key}`);
  }
});
test('account switcher isolates bidi names and localizes count and state', () => {
  const s = read('apps/web/src/components/TenantSwitcher.tsx');
  assert.match(s, /<bdi>\{session\.displayName\}<\/bdi>/);
  assert.match(s, /Intl\.NumberFormat\(selectedLocale === 'ar' \? 'ar-SA' : selectedLocale\)/);
  assert.match(s, /tx\('current'\)/);
});

test('shared table controls and count templates cover the selected frontend locale', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, translationHasMatchingPlaceholders } = await import('../apps/web/src/lib/ui-labels.mjs');
  const s = read('apps/web/src/components/DataTable.tsx');
  assert.match(s, /normalizeFrontendLocale\(root.lang\)/);
  assert.match(s, /uiLabel\(label, locale, legacy\(label\)\)/);
  assert.match(s, /aria-label=\{t\('Table results'\)\}/);
  assert.ok(s.includes("t('Sort by {column}').replace"));
  for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
    for (const label of ["Filter…","Filter rows","Clear filter","{count} rows","{shown} of {total}","Nothing matches that filter","Nothing here yet","Try a shorter search, or clear the filter.","Table results","Sort by {column}"]) {
      const value = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof value === 'string' && value.trim(), locale + ': ' + label);
      assert.ok(translationHasMatchingPlaceholders(label, value), locale + ': ' + label);
      assert.equal(uiLabel(label, locale), value);
    }
  }
});

test('mobile navigation actions explicitly cover every supported locale', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, translationHasMatchingPlaceholders } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
    for (const label of ['Open navigation', 'Close navigation', 'Close', 'Modules']) {
      const value = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof value === 'string' && value.trim(), locale + ': ' + label);
      assert.ok(translationHasMatchingPlaceholders(label, value));
      assert.equal(uiLabel(label, locale), value);
    }
  }
});

test('account controls cover every supported frontend locale', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
    for (const label of ["capabilities","current","Switch workspace","Workspace","Sign out all devices","revoke every active session","Sign out","end this session"]) {
      const value = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof value === 'string' && value.trim(), locale + ': ' + label);
      assert.equal(uiLabel(label, locale), value);
    }
  }
});

test('account role display labels cover each supported locale without modifying role identifiers', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale } = await import('../apps/web/src/lib/ui-labels.mjs');
  const s = read('apps/web/src/components/TenantSwitcher.tsx');
  assert.ok(s.includes("tx(session.role.replace(/_/g, ' '))"));
  assert.ok(s.includes("tx(t.role.replace(/_/g, ' '))"));
  for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
    for (const role of ["owner","admin","manager","member","viewer"]) {
      const value = UI_LABELS[role]?.[catalogLocale(locale)];
      assert.ok(typeof value === 'string' && value.trim(), locale + ': ' + role);
      assert.equal(uiLabel(role, locale), value);
    }
  }
});

test('command palette and rail controls have explicit frontend locale mappings', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
    for (const label of ["Search","Command palette","Search — command palette","Jump to a module…","Nothing matches","move","open","close","Expand the menu","Collapse the menu"]) {
      const value = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof value === 'string' && value.trim(), locale + ': ' + label);
      assert.equal(uiLabel(label, locale), value);
    }
  }
  const layout = read('apps/web/src/app/(app)/layout.tsx');
  assert.ok(layout.includes('<RailToggle locale={locale} />'));
  assert.ok(layout.includes("<CommandPalette commands={commands} lang={locale === 'ar' ? 'ar' : 'en'} locale={locale} />"));
});
