/**
 * Audit shared navigation label coverage across the registered frontend locales.
 * This checks navigation only; it never claims full-screen or document coverage.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { FRONTEND_LOCALES } from '../apps/web/src/lib/frontend-locale.mjs';
import { UI_LABELS, catalogLocale, uiLabel, translationHasMatchingPlaceholders, uiLabelCoverage } from '../apps/web/src/lib/ui-labels.mjs';

const nav = readFileSync(new URL('../apps/web/src/lib/nav.ts', import.meta.url), 'utf8');
const labels = [...new Set([...nav.matchAll(/label:\s*'([^']+)'/g)].map(m => m[1]))];
const arText = readFileSync(new URL('../packages/contracts/src/nav-locale.ts', import.meta.url), 'utf8');
const arabic = Object.fromEntries([...arText.matchAll(/^\s*(".*?"):\s*(".*?"),?$/gm)]
  .map(([, key, value]) => [JSON.parse(key), JSON.parse(value)]));
assert.equal(FRONTEND_LOCALES.length, 23, 'locale registry must contain 23 variants');
assert.ok(labels.length >= 30, 'navigation inventory unexpectedly small');
const results = FRONTEND_LOCALES.map(locale => ({
  locale, ...uiLabelCoverage(labels, locale, arabic)
}));
for (const record of results) {
  assert.equal(record.translated + record.missing.length + record.invalidPlaceholders.length, record.total);
  process.stdout.write(`${record.locale.padEnd(8)} ${String(record.translated).padStart(2)}/${record.total} navigation strings translated; missing=${record.missing.length}; invalid placeholders=${record.invalidPlaceholders.length}\n`);
}
for (const locale of ['en-US', 'en-GB', 'ar']) {
  const record = results.find(x => x.locale === locale);
  assert.equal(record?.missing.length, 0, `${locale} has missing shared navigation translations`);
}
// Billing is outside the current remediation scope. Explicit mappings may
// legitimately equal the English source (e.g. Power BI or shared loanwords).
const excluded = new Set(['Billing & Renewals', 'Subscriptions']);
const required = labels.filter(label => !excluded.has(label));
for (const locale of FRONTEND_LOCALES) {
  if (locale.startsWith('en-')) continue;
  for (const label of required) {
    const row = UI_LABELS[label];
    const key = catalogLocale(locale);
    const legacy = locale === 'ar' ? arabic[label] : undefined;
    assert.ok(row && Object.hasOwn(row,key), `${locale}: missing explicit mapping for ${label}`);
    assert.ok(typeof row[key] === 'string' && row[key].trim(), `${locale}: empty mapping for ${label}`);
    assert.ok(translationHasMatchingPlaceholders(label,row[key]), `${locale}: invalid placeholders for ${label}`);
    const expected = typeof legacy === 'string' && legacy.trim() && legacy !== label && translationHasMatchingPlaceholders(label,legacy) ? legacy : row[key];
    assert.equal(uiLabel(label,locale,legacy),expected,`${locale}: unexpected fallback for ${label}`);
  }
}
console.log(`Enforced ${required.length} non-billing navigation labels across all ${FRONTEND_LOCALES.length} registered locale variants (English source, explicit non-English mappings). This does NOT certify full product translation coverage.`);

// Catalog-wide source coverage: report every shared UI key, not just navigation.
// Explicit unchanged terms are brands or native-language cognates, not missing
// translations. The allowlist is narrowly scoped to exact locale/source pairs;
// no generic English fallback is accepted as translated.
const allCatalogKeys = Object.keys(UI_LABELS);
assert.ok(allCatalogKeys.length >= required.length, 'UI catalog smaller than required navigation inventory');
const sharedBrands = new Set(['Power BI', 'The EPMO']);
const nativeIdentical = {
  de: new Set(['Person', 'Analyse', 'Portfolios']),
  fr: new Set(['Analyse', 'Notifications', 'Documents', 'Modules']),
};
const catalogResults = FRONTEND_LOCALES.map(locale => ({ locale, ...uiLabelCoverage(allCatalogKeys, locale, arabic) }));
for (const record of catalogResults) {
  assert.equal(record.translated + record.missing.length + record.invalidPlaceholders.length, record.total,
    record.locale + ': catalog coverage accounting drift');
  if (record.locale.startsWith('en-')) continue;
  const accepted = new Set([...(record.locale === 'ar' ? [] : sharedBrands), ...(nativeIdentical[record.locale] ?? [])]);
  // An allowed unchanged word must actually be in the catalog and unchanged.
  // A stale exception should fail CI instead of hiding deleted or translated keys.
  for (const term of accepted) {
    assert.ok(record.missing.includes(term), record.locale + ': obsolete identical-text exception ' + term);
  }
  const unexpected = record.missing.filter(term => !accepted.has(term));
  process.stdout.write('CATALOG ' + record.locale.padEnd(8) +
    ' mapped=' + record.translated + '/' + record.total +
    '; accepted-unchanged=' + accepted.size +
    '; unexpected-unchanged-or-missing=' + unexpected.length +
    '; invalid-placeholders=' + record.invalidPlaceholders.length + '\n');
  if (unexpected.length) process.stdout.write('  UNEXPECTED ' + record.locale + ': ' + JSON.stringify(unexpected) + '\n');
  assert.deepEqual(unexpected, [], record.locale + ': new missing or English-identical UI translations');
  assert.deepEqual(record.invalidPlaceholders, [], record.locale + ': invalid placeholder translations');
}
process.stdout.write('PASS: all shared UI catalog entries mapped across 23 variants, with precisely enumerated unchanged names and native-language equivalents.\n');
process.stdout.write('LIMITATION: This certifies only the 208-key shared UI catalog source integrity. It does NOT certify all application screens, API errors, emails, document exports, native reviewer approval, or production acceptance.\n');
