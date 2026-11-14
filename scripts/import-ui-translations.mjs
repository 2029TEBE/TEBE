// Offline, review-gated importer. Does not call any translation provider.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const args = process.argv.slice(2);
const inputPath = args.find(arg => !arg.startsWith('--'));
if (!inputPath || args.filter(arg => arg.startsWith('--')).some(arg =>
  !['--apply', '--replace', '--allow-identical'].includes(arg))) {
  throw new Error('Usage: node scripts/import-ui-translations.mjs path/to/reviewed.json [--apply] [--replace] [--allow-identical]');
}
const apply = args.includes('--apply');
const replace = args.includes('--replace');
const allowIdentical = args.includes('--allow-identical');
const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const input = JSON.parse(readFileSync(resolve(inputPath), 'utf8'));
const keys = JSON.parse(read('translation-source.json'));
const known = new Set(keys);
const webPath = 'apps/web/src/lib/generated-translations.mjs';
const contractsPath = 'packages/contracts/src/generated-translations.ts';
const web = read(webPath);
const contract = read(contractsPath);
const webMarker = 'export const UI_TRANSLATIONS = Object.freeze(';
const webEnd = ');\nexport const COMPLETE_UI_LOCALES = ';
const webStart = web.indexOf(webMarker);
const webStop = web.lastIndexOf(webEnd);
const contractsMarker = 'export const UI_TRANSLATIONS = ';
const contractStart = contract.indexOf(contractsMarker);
if (webStart < 0 || webStop < 0 || contractStart < 0) {
  throw new Error('Unknown generated catalog format; refusing to edit.');
}
const catalog = JSON.parse(web.slice(webStart + webMarker.length, webStop));
const backend = JSON.parse(contract.slice(contractStart + contractsMarker.length, contract.lastIndexOf(';')));
if (!isDeepStrictEqual(catalog, backend)) {
  throw new Error('Frontend/backend catalog drift; resolve before importing.');
}
const signature = value => [...value.matchAll(/\{[a-zA-Z][\w]*\}|<\/?[a-z][^>]*>/g)]
  .map(match => match[0]).sort().join('|');
if (!input || typeof input !== 'object' || Array.isArray(input)) {
  throw new Error('Expected object: { "locale": { "English source": "reviewed translation" } }.');
}
let added = 0, changed = 0;
for (const [locale, pairs] of Object.entries(input)) {
  if (!Object.hasOwn(catalog, locale) || !pairs || typeof pairs !== 'object' || Array.isArray(pairs)) {
    throw new Error('Invalid or unsupported locale: ' + locale);
  }
  for (const [key, value] of Object.entries(pairs)) {
    if (!known.has(key)) throw new Error('Unknown source key for ' + locale + ': ' + key);
    if (typeof value !== 'string' || !value.trim()) throw new Error('Missing translation for ' + locale + ': ' + key);
    if (signature(value) !== signature(key)) throw new Error('Placeholder/markup mismatch for ' + locale + ': ' + key);
    if (!allowIdentical && value === key) throw new Error('Untranslated English source for ' + locale + ': ' + key);
    const previous = catalog[locale][key];
    if (previous === value) continue;
    if (previous && !replace) throw new Error('Refusing to overwrite existing translation without --replace: ' + locale + ': ' + key);
    catalog[locale][key] = value;
    if (previous) changed++;
    else added++;
  }
}
const report = {};
for (const [locale, translations] of Object.entries(catalog)) {
  const extra = Object.keys(translations).filter(key => !known.has(key));
  if (extra.length) throw new Error('Untracked translations in ' + locale);
  const missing = keys.filter(key => typeof translations[key] !== 'string' || !translations[key].trim());
  const invalid = keys.filter(key => typeof translations[key] === 'string' && translations[key].trim() &&
    signature(key) !== signature(translations[key]));
  if (invalid.length) throw new Error('Invalid placeholders in ' + locale + ': ' + invalid.join(', '));
  report[locale] = { total: keys.length, translated: keys.length - missing.length, missing };
}
const complete = Object.keys(report).filter(locale => report[locale].missing.length === 0);
const frontend = web.slice(0, webStart) + webMarker + JSON.stringify(catalog) + webEnd +
  JSON.stringify(complete) + ';\n';
const contracts = contract.slice(0, contractStart) + contractsMarker + JSON.stringify(catalog) + ';\n';
const outstanding = Object.values(report).reduce((total, row) => total + row.missing.length, 0);
console.log('Preview: added=' + added + ', replaced=' + changed + ', outstanding=' + outstanding);
console.log('Catalog-inventory-complete: ' + complete.join(', '));
if (apply) {
  if (added || changed) {
    writeFileSync(new URL(webPath, root), frontend);
    writeFileSync(new URL(contractsPath, root), contracts);
    writeFileSync(new URL('translation-coverage.json', root), JSON.stringify(report, null, 2) + '\n');
  }
  console.log('Catalogs updated; run coverage and locale tests. Review and commit generated diffs.');
} else {
  console.log('Dry run only. Use --apply after native-language and source approval; no remote translation performed.');
}
