/** E65: edit a disposable pnpm patch extraction of glob@7.2.3 only.
 * The generated patch is a candidate until frozen install, security audit,
 * sync/async glob regression and ExcelJS buffered/streaming tests pass.
 * Never modify installed node_modules in the deployable source graph.
 */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
const dir = process.argv[2];
assert.ok(dir && resolve(dir) !== process.cwd(), 'Pass an isolated pnpm patch extraction directory');
const replacement = "(typeof pn.test === 'function' ? pn.test(e) : e.match(pn))";
for (const name of ['sync.js', 'glob.js']) {
  const path = join(resolve(dir), name);
  const source = readFileSync(path, 'utf8');
  assert.equal(source.split('var rawGlob = pn._glob').length - 1, 1, name + ': expected one legacy rawGlob');
  assert.equal(source.split('e.match(pn)').length - 1, 2, name + ': expected two legacy matcher calls');
  const patched = source
    .replace('var rawGlob = pn._glob', "var rawGlob = pn._glob || (typeof pn.pattern === 'string' ? pn.pattern : '')")
    .replaceAll('e.match(pn)', replacement);
  assert.notEqual(patched, source);
  writeFileSync(path, patched);
}
console.log('E65: prepared isolated glob@7.2.3 package patch for minimatch 11 Matcher.test; pending independent CI');
