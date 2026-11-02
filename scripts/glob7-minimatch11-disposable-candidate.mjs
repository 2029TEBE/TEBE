/**
 * Disposable-only compatibility experiment for glob@7 + patched minimatch@11.
 * Changes installed CI node_modules, NEVER repository source or release dependencies.
 * This does not establish security acceptance.
 */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {spawnSync} from 'node:child_process';

const store = resolve('node_modules/.pnpm');
const globDir = readdirSync(store).find(name => /^glob@7\.2\.3(?:_|$)/.test(name));
assert.ok(globDir, 'glob@7.2.3 must exist in disposable frozen candidate');
const packageDir = join(store, globDir, 'node_modules/glob');
const original = '  var rawGlob = pn._glob\n';
const replacement = `  // Disposable experiment: minimatch 11 omits the legacy RegExp._glob field.
  // Recover the original segment from the same compiled pattern index.
  var rawGlob = pn._glob
  if (rawGlob === undefined) {
    var originalParts = this.minimatch.globParts && this.minimatch.globParts[index]
    var segmentIndex = this.minimatch.set[index].length - remain.length
    rawGlob = originalParts && originalParts[segmentIndex]
  }
  if (typeof rawGlob !== 'string')
    throw new Error('minimatch 11 legacy glob segment mapping unavailable')
`;
for (const name of ['sync.js', 'glob.js']) {
  const file = join(packageDir, name);
  const content = readFileSync(file, 'utf8');
  assert.equal(content.split(original).length, 2, name + ' exact legacy expression must occur once');
  writeFileSync(file, content.replace(original, replacement));
}
const result = spawnSync(process.execPath, ['scripts/legacy-glob-minimatch-compat.mjs'], {encoding:'utf8', timeout: 30000});
if (result.status !== 0) {
  const clean = String(result.stderr || '').replace(/\/home\/runner\/[^\s:)]+/g, '<runner-path>');
  console.error('FAIL disposable legacy glob/minimatch compatibility candidate: ' + clean.slice(0,1800));
  process.exit(1);
}
assert.match(result.stdout, /PASS synthetic glob@7\.2\.3/);
console.log('PASS disposable legacy glob 7 / minimatch 11 candidate; exactHeadSha=' +
  (process.env.EPMO_CANDIDATE_SHA || 'UNKNOWN') +
  '; scope=CI_INSTALLED_MODULE_PATCH_ONLY_NOT_COMMITTED_NOT_SECURITY_ACCEPTANCE');
