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

test('record validation messages cover all registered locales', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { formErrorText } = await import('../apps/web/src/lib/create-form-validation.mjs');
  for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
    for (const code of ["invalid_project_code","invalid_date","end_before_start","nonnegative","finite_number","currency","required","invalid","range_0_100","range_1_100","range_1_5"]) {
      assert.notEqual(formErrorText(code, locale), formErrorText(code, 'en'), locale + ': ' + code);
      assert.ok(formErrorText(code, locale).trim());
    }
  }
  assert.equal(formErrorText('__proto__', 'de'), formErrorText('invalid', 'de'));
});

test('shared page loading errors have explicit locale coverage', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
    for (const label of ["Unable to load this data","There was a problem loading this content. Refresh the page, or contact your workspace administrator if the issue continues."]) {
      assert.notEqual(uiLabel(label, locale), label, locale + ': ' + label);
    }
  }
});


test('shared catalog has explicit in-scope coverage for every locale', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, uiLabelCoverage } = await import('../apps/web/src/lib/ui-labels.mjs');
  const labels = Object.keys(UI_LABELS).filter(label => !['Billing & Renewals', 'Subscriptions'].includes(label));
  for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
    const coverage = uiLabelCoverage(labels, locale);
    // An unchanged product name is intentionally reported as untranslated,
    // not falsely included in the completion percentage.
    const { catalogLocale, translationHasMatchingPlaceholders } =
      await import('../apps/web/src/lib/ui-labels.mjs');
    const normalized = catalogLocale(locale);
    const unchanged = labels.filter(label => UI_LABELS[label][normalized] === label);
    for (const label of labels) {
      const translated = UI_LABELS[label][normalized];
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.ok(translationHasMatchingPlaceholders(label, translated), locale + ': ' + label);
    }
    assert.deepEqual(coverage.missing, unchanged, locale + ': unchanged labels must be disclosed');
    assert.deepEqual(coverage.invalidPlaceholders, [], locale + ': invalid placeholders');
  }
  assert.deepEqual(uiLabelCoverage(['An unknown untranslated label'], 'fr-FR').missing, ['An unknown untranslated label']);
});

test('projects title follows selected locale rather than the legacy English-Arabic toggle', async () => {
  const page = read('apps/web/src/app/(app)/projects/page.tsx');
  assert.match(page, /<Page title="Projects"/);
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
    assert.notEqual(uiLabel('Projects', locale), 'Projects', locale);
  }
});

test('project onboarding calls to action use registered translations in every locale', async () => {
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  const page = read('apps/web/src/app/(app)/projects/page.tsx');
  const labels = ['Set up your project structure', 'Set up portfolio and programme'];
  for (const label of labels) {
    assert.ok(page.includes("t('" + label + "')"), label + ' is wired to locale');
    for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
      const value = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof value === 'string' && value.trim(), locale + ': ' + label);
      assert.equal(uiLabel(label, locale), value, locale + ': ' + label);
      assert.notEqual(value, label, locale + ': untranslated ' + label);
    }
  }
});

test('project governance table action resolves every supported frontend locale', async () => {
  const table = read('apps/web/src/app/(app)/projects/ProjectsTable.tsx');
  assert.match(table, /t\('Open governance'\)/);
  assert.match(table, /normalizeFrontendLocale\(root\.lang\)/);
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { uiLabel, UI_LABELS, catalogLocale } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
    const translated = UI_LABELS['Open governance']?.[catalogLocale(locale)];
    assert.ok(typeof translated === 'string' && translated.trim(), locale);
    assert.equal(uiLabel('Open governance', locale), translated, locale);
    assert.notEqual(translated, 'Open governance', locale);
  }
});


test('project empty states and create permissions are localized across frontend locales', async () => {
  const page = read('apps/web/src/app/(app)/projects/page.tsx');
  const labels = [
    'Create your first project above with its governance gates.',
    'Ask an authorized administrator to create the first project.',
    'Creating projects requires project-management permission and an enabled PMO module.',
  ];
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const label of labels) {
    assert.ok(page.includes("t('" + label + "')"), label + ': localized call');
    for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
      const translated = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.notEqual(translated, label, locale + ': missing translation');
      assert.equal(uiLabel(label, locale), translated, locale + ': catalog lookup');
    }
  }
});

test('projects subtitle and strategy guidance use catalog translations for all frontend locales', async () => {
  const page = read('apps/web/src/app/(app)/projects/page.tsx');
  const labels = [
    'Everything being delivered, with budget, health and progress. Creating a project also opens its first gate.',
    'You can create a standalone project now, but we recommend a portfolio and programme first to connect it to your strategy.',
  ];
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const label of labels) {
    assert.ok(page.includes("t('" + label + "')"), label + ': wiring');
    for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
      const translated = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.notEqual(translated, label, locale + ': untranslated');
      assert.equal(uiLabel(label, locale), translated, locale + ': lookup');
    }
  }
});

test('report title, no-definitions state and on-demand schedule support all frontend locales', async () => {
  const reports = read('apps/web/src/app/(app)/reports/page.tsx');
  const labels = ['Reporting & Exports', 'No report definitions yet.', 'On demand'];
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const label of labels) {
    assert.ok(reports.includes("t('" + label + "')"), label + ': report locale wiring');
    for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
      const translated = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.notEqual(translated, label, locale + ': untranslated');
      assert.equal(uiLabel(label, locale), translated, locale + ': lookup');
    }
  }
});

test('report generation status and board pack action resolve all supported frontend locales', async () => {
  const page = read('apps/web/src/app/(app)/reports/page.tsx');
  const labels = ['Never generated', 'Open shared board pack'];
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const label of labels) {
    assert.ok(page.includes("t('" + label + "')"), label + ': missing wiring');
    for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
      const translated = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.notEqual(translated, label, locale + ': untranslated label');
      assert.equal(uiLabel(label, locale), translated, locale + ': lookup');
    }
  }
});


test('report overview heading and accessibility text are localized in all frontend locales', async () => {
  const page = read('apps/web/src/app/(app)/reports/page.tsx');
  const labels = ['Reporting overview', 'REPORTING OVERVIEW'];
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const label of labels) {
    assert.ok(page.includes("t('" + label + "')"), label + ': locale wiring');
    for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
      const translated = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.notEqual(translated, label, locale + ': untranslated');
      assert.equal(uiLabel(label, locale), translated, locale + ': lookup');
    }
  }
});

test('board pack heading and live-data description are translated in all frontend locales', async () => {
  const page = read('apps/web/src/app/(app)/reports/page.tsx');
  const labels = [
    'Board pack',
    'Board packs generated from live data rather than assembled by hand.',
  ];
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const label of labels) {
    assert.ok(page.includes("t('" + label + "')"), label + ': locale wiring');
    for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
      const translated = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.notEqual(translated, label, locale + ': untranslated');
      assert.equal(uiLabel(label, locale), translated, locale + ': lookup');
    }
  }
});

test('report catalogue, generation timestamp and shared pack notice are localized for every frontend locale', async () => {
  const page = read('apps/web/src/app/(app)/reports/page.tsx');
  const labels = [
    'Report catalogue',
    'Last generated',
    'Each link in the table opens the shared board pack, not a separate preview of that report definition.',
  ];
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const label of labels) {
    assert.ok(page.includes("t('" + label + "')"), label + ': expected active-locale rendering');
    for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
      const translated = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.notEqual(translated, label, locale + ': untranslated');
      assert.equal(uiLabel(label, locale), translated, locale + ': lookup');
    }
  }
});

test('report table labels and generation metrics have non-English translations for all supported frontend locales', async () => {
  const page = read('apps/web/src/app/(app)/reports/page.tsx');
  const labels = ['Report', 'Audience', 'Report definitions', 'Previously generated', 'Not yet generated'];
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const label of labels) {
    assert.ok(page.includes("t('" + label + "')"), label + ': active-locale rendering');
    for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
      const translated = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.notEqual(translated, label, locale + ': untranslated');
      assert.equal(uiLabel(label, locale), translated, locale + ': catalog lookup');
    }
  }
});


test('report export and board-pack action labels resolve in all frontend locale variants', async () => {
  const page = read('apps/web/src/app/(app)/reports/page.tsx');
  const labels = ['Download Word', 'Download PowerPoint', 'Download PDF', 'Open the board pack'];
  const { FRONTEND_LOCALES } = await import('../apps/web/src/lib/frontend-locale.mjs');
  const { UI_LABELS, catalogLocale, uiLabel } = await import('../apps/web/src/lib/ui-labels.mjs');
  for (const label of labels) {
    assert.ok(page.includes("t('" + label + "')"), label + ': missing locale wiring');
    for (const locale of FRONTEND_LOCALES.filter(code => !code.startsWith('en-'))) {
      const translated = UI_LABELS[label]?.[catalogLocale(locale)];
      assert.ok(typeof translated === 'string' && translated.trim(), locale + ': ' + label);
      assert.notEqual(translated, label, locale + ': untranslated');
      assert.equal(uiLabel(label, locale), translated, locale + ': lookup');
    }
  }
});
