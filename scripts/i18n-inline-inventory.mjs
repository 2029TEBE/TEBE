/**
 * Non-blocking localization gap inventory. No source content or customer data
 * is emitted: only paths and counts. Results are candidates for manual review.
 * The scan is NOT a translation completeness certificate.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const directories = ['apps/web/src', 'apps/api/src'];
const allowed = new Set(['.tsx', '.ts', '.mjs', '.js']);
const exclusions = new Set(['node_modules', '.next', 'dist', 'coverage']);
const records = [];

function inspect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (exclusions.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { inspect(path); continue; }
    if (!entry.isFile() || ![...allowed].some(ext => path.endsWith(ext))) continue;
    if (/\.test\.|\.spec\.|__tests__/.test(path)) continue;
    const content = readFileSync(path, 'utf8');
    const arabicLines = content.split(/\r?\n/).filter(line => /[\u0600-\u06ff]/u.test(line)).length;
    const inlineLocaleBranches = [...content.matchAll(/(?:lang|locale)\s*===?\s*['"]ar['"]/g)].length;
    if (arabicLines || inlineLocaleBranches) {
      records.push({
        file: relative(root, path).replaceAll('\\', '/'),
        arabicLines,
        inlineLocaleBranches,
      });
    }
  }
}
for (const directory of directories) inspect(join(root, directory));
records.sort((a,b) => a.file.localeCompare(b.file));
const summary = {
  audit: 'source-candidates-only',
  completenessCertified: false,
  filesWithCandidates: records.length,
  arabicLines: records.reduce((sum, r) => sum + r.arabicLines, 0),
  inlineLocaleBranches: records.reduce((sum, r) => sum + r.inlineLocaleBranches, 0),
  records,
};
console.log(JSON.stringify(summary, null, 2));
