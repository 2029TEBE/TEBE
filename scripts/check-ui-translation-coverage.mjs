import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { UI_TRANSLATIONS, COMPLETE_UI_LOCALES } from '../apps/web/src/lib/generated-translations.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const keys = JSON.parse(read('translation-source.json'));
const report = JSON.parse(read('translation-coverage.json'));
const contractSource = read('packages/contracts/src/generated-translations.ts');
const contractCopy = JSON.parse(contractSource.slice(contractSource.indexOf(' = ') + 3, contractSource.lastIndexOf(';')));
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const released = args.includes('--released');
const unknown = args.filter(arg => !['--strict', '--released'].includes(arg));
if (unknown.length) throw new Error(`Unsupported translation coverage arguments: ${unknown.join(', ')}`);

const signature = value => [...value.matchAll(/\{[a-zA-Z][\w]*\}|<\/?[a-z][^>]*>/g)]
  .map(match => match[0]).sort().join('|');
let missingTotal = 0, invalidTotal = 0, reportMismatches = 0;
const sourceKeys = new Set(keys);

if (sourceKeys.size !== keys.length) throw new Error('Translation source inventory has duplicate entries.');
if (!isDeepStrictEqual(contractCopy, UI_TRANSLATIONS)) {
  throw new Error('Frontend and contracts translation catalogs have drifted.');
}
if (!isDeepStrictEqual(Object.keys(report).sort(), Object.keys(UI_TRANSLATIONS).sort())) {
  throw new Error('Coverage report locale set differs from actual catalogs.');
}

const fullyCovered = [];
for (const [locale, copy] of Object.entries(UI_TRANSLATIONS)) {
  const gaps = keys.filter(key => typeof copy[key] !== 'string' || !copy[key].trim());
  const invalid = keys.filter(key => typeof copy[key] === 'string' && copy[key].trim() &&
    signature(key) !== signature(copy[key]));
  const extraneous = Object.keys(copy).filter(key => !sourceKeys.has(key));
  const expected = { total: keys.length, translated: keys.length - gaps.length, missing: gaps };
  if (!isDeepStrictEqual(report[locale], expected) || extraneous.length) {
    reportMismatches++;
    console.error(`${locale}: coverage report stale or ${extraneous.length} untracked entries`);
  }
  if (gaps.length === 0 && invalid.length === 0) fullyCovered.push(locale);
  missingTotal += gaps.length;
  invalidTotal += invalid.length;
  console.log(`${locale}: ${keys.length - gaps.length - invalid.length}/${keys.length}; missing=${gaps.length}; invalid=${invalid.length}`);
}

if (!isDeepStrictEqual([...COMPLETE_UI_LOCALES].sort(), fullyCovered.sort())) {
  throw new Error('COMPLETE_UI_LOCALES differs from the set of fully populated catalogs.');
}
if (reportMismatches || invalidTotal || (strict && missingTotal) || (released && fullyCovered.length === 0)) {
  process.exitCode = 1;
}
console.log(`Total missing=${missingTotal}, invalid=${invalidTotal}, report mismatches=${reportMismatches}.`);
if (!strict && missingTotal) {
  console.log('Partial catalogs are NOT translation-complete. Run --strict to require zero missing entries.');
}
if (released) {
  console.log('Catalog coverage does not establish native-language review, dynamic UI, browser or export acceptance.');
}
