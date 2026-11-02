/**
 * Narrow compatibility regression for the audited minimatch 11 workspace
 * override used by ExcelJS/archiver's legacy glob 7 dependency.
 * Synthetic filesystem only; this is not security or staging acceptance.
 */
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const store = resolve('node_modules/.pnpm');
const glob7 = readdirSync(store).find(name => /^glob@7\.2\.3(?:_|$)/.test(name));
assert.ok(glob7, 'Frozen lockfile must install glob@7.2.3 for this compatibility test');
const globRequire = createRequire(pathToFileURL(join(store, glob7, 'node_modules/glob/package.json')));
const glob = globRequire('glob');
const mm = globRequire('minimatch');
assert.equal(typeof mm.Minimatch, 'function', 'Minimatch class API missing from override');
assert.equal(typeof glob.sync, 'function', 'glob 7 sync API missing');
assert.equal(typeof glob, 'function', 'glob 7 async API missing');
const fixture = mkdtempSync(join(tmpdir(), 'epmo-glob7-'));
try {
  mkdirSync(join(fixture, 'nested'));
  writeFileSync(join(fixture, 'a.txt'), 'synthetic');
  writeFileSync(join(fixture, 'nested', 'b.txt'), 'synthetic');
  writeFileSync(join(fixture, 'nested', 'ignore.json'), '{}');
  const expected = ['a.txt', 'nested/b.txt'];
  assert.deepEqual(glob.sync('**/*.txt', {cwd: fixture, nodir: true}).sort(), expected);
  const asyncResults = await new Promise((resolvePromise, reject) => {
    glob('**/*.txt', {cwd: fixture, nodir: true}, (error, matches) =>
      error ? reject(error) : resolvePromise(matches));
  });
  assert.deepEqual(asyncResults.sort(), expected);
  assert.equal(glob.hasMagic('**/*.txt'), true);
  console.log('PASS synthetic glob@7.2.3 sync/async matching with locked minimatch override (NOT security acceptance)');
} finally {
  rmSync(fixture, {recursive: true, force: true});
}
