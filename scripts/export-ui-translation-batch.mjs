// Export the next source-only translation batch for human/AI review.
// This command never contacts a translation provider or writes files.
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const report = JSON.parse(readFileSync(new URL('translation-coverage.json', root), 'utf8'));
const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1]; };
const locale = option('--locale'), offset = Number(option('--offset') ?? 0), limit = Number(option('--limit') ?? 50);
if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
  throw new Error('Invalid --offset or --limit; limit range is 1..500.');
}
if (!locale) {
  console.log('Missing translations (smallest outstanding catalog first):');
  for (const [lang, data] of Object.entries(report).sort((a, b) =>
    a[1].missing.length - b[1].missing.length || a[0].localeCompare(b[0]))) {
    console.log(lang.padEnd(8) + ' ' + String(data.missing.length).padStart(5) + '/' + data.total);
  }
  console.log('Export: node scripts/export-ui-translation-batch.mjs --locale ko --limit 50 --offset 0');
} else {
  if (!Object.hasOwn(report, locale)) throw new Error('Unrecognized locale ' + locale);
  const entries = report[locale].missing.slice(offset, offset + limit);
  console.log(JSON.stringify({ [locale]: Object.fromEntries(entries.map(key => [key, ''])) }, null, 2));
  console.error('Review-only template; replace every empty value with genuinely translated copy before importing. Source-only; no user data.');
  console.error('Remaining ' + report[locale].missing.length + ', batch ' + offset + '..' + (offset + entries.length));
}
