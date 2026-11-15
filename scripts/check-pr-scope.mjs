// Run against committed changes. Fetch the target ref before running.
// node scripts/check-pr-scope.mjs origin/main path/to/file [another/file ...]
// Declare exact repository-relative paths, including both sides of a rename.
import { execFileSync } from 'node:child_process';

const [base = '', ...allowedPaths] = process.argv.slice(2);
if (!base || allowedPaths.length === 0 || base.startsWith('-')) {
  console.error('Usage: node scripts/check-pr-scope.mjs <target-ref> <allowed-path> [...]');
  process.exit(2);
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trimEnd();
const mergeBase = git('merge-base', base, 'HEAD');
const diff = execFileSync('git', ['diff', '--numstat', '-z', '--no-renames', mergeBase, 'HEAD', '--'], {
  cwd: git('rev-parse', '--show-toplevel'), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
});
const files = diff.split('\0').filter(Boolean).map(record => {
  const [, added, deleted, path] = /^(\d+|-)\t(\d+|-)\t([\s\S]+)$/.exec(record);
  return { path, lines: Number(added) + Number(deleted), binary: added === '-' };
});
const scope = new Set(allowedPaths);
const outside = files.filter(file => !scope.has(file.path));
const binary = files.filter(file => file.binary);
const lines = files.reduce((total, file) => total + (file.binary ? 0 : file.lines), 0);

console.log(`${files.length} changed paths, ${lines} changed text lines (additions + deletions).`);
if (files.length > 15 || lines > 300) console.warn('Size advisory: review whether this patch can be split.');
for (const file of outside) console.error('Outside declared scope:', JSON.stringify(file.path));
for (const file of binary) console.error('Binary change needs separate review:', JSON.stringify(file.path));
const oversized = files.length > 25 || lines > 600;
if (oversized) console.error('Size limit exceeded (25 paths or 600 lines). Split the patch or request maintainer review.');
if (outside.length || binary.length || oversized) process.exitCode = 1;
