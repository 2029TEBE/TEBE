import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const block=workflow.split('concurrency:\n')[1]?.split('permissions:\n')[0]??'';

test('main verification uses a revision-aware concurrency group',()=>{
  assert.match(block,/format\('tebe-ci-main-\{0\}', github\.sha\)/);
  assert.doesNotMatch(block,/\|\| 'tebe-ci-main'/);
});

test('only superseded PR verification cancels in-progress checks',()=>{
  assert.match(block,/cancel-in-progress:\s*\$\{\{ github\.event_name == 'pull_request' \}\}/);
  assert.match(block,/format\('tebe-ci-pr-\{0\}', github\.event\.pull_request\.number\)/);
  assert.doesNotMatch(block,/cancel-in-progress:\s*true/);
});
