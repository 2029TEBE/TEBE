// Static i18n QA triage; advisory only. Identical copies may be legitimate names.
import { UI_TRANSLATIONS } from '../apps/web/src/lib/generated-translations.mjs';
import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(new URL('../translation-coverage.json', import.meta.url), 'utf8'));
const legitimate = new Set([
  'PDF','Word','PowerPoint','Microsoft 365','Power BI','CPI','RLS','UTC','API','AI',
  'HTML','CSS','HTTP','HTTPS','SQLite','GitHub','Excel','JSON','CSV','Microsoft',
  'URL','ID','EPMO','The EPMO','SharePoint','OneDrive','Entra ID','Amazon SES',
]);
const technical = /^[\s;=.{}()[\]-]*$|^[A-Z]$|^https?:|^\{[a-zA-Z][\w]*\}$|^[\w.-]+@[\w.-]+\.\w+$/;
for (const [locale, dict] of Object.entries(UI_TRANSLATIONS)) {
  const suspicious = Object.entries(dict)
    .filter(([source, translated]) => source.trim().toLocaleLowerCase('en') ===
      translated.trim().toLocaleLowerCase('en') &&
      source.trim().length > 3 && !legitimate.has(source.trim()) && !technical.test(source.trim()))
    .map(([source]) => source);
  const prefix = locale.padEnd(8) + ' gaps=' + String(report[locale].missing.length).padStart(5) +
    ' identicalNontrivial=' + String(suspicious.length).padStart(4);
  console.log(prefix);
  if (suspicious.length) console.log('  Review examples: ' +
    suspicious.slice(0, 12).map(s => JSON.stringify(s)).join(', '));
}
console.log('Advisory only: identical text may be a legitimate untranslated proper name, acronym, or loanword.');
console.log('Presence of a translation entry is NOT evidence of linguistic quality or complete application coverage.');
