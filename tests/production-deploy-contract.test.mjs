import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
const deploy = readFileSync(new URL('../infra/deploy.sh', import.meta.url), 'utf8');

test('production deploy never runs without successful main push CI and explicit activation',()=>{
  for (const gate of [
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.head_branch == 'main'",
    "github.event.workflow_run.head_repository.full_name == github.repository",
    "vars.EPMO_DEPLOY_ENABLED == 'true'",
  ]) assert.ok(workflow.includes(gate), 'Missing activation gate: '+gate);
});

test('production deploy pins SHA, refuses stale head, and serializes instead of cancelling',()=>{
  for (const marker of [
    'cancel-in-progress: false',
    'ref: ${{ github.event.workflow_run.head_sha }}',
    'github.event.workflow_run.head_sha',
    'api.github.com/repos/',
    "jq -er '.commit.sha'",
    'EPMO_CI_VERIFIED_SHA:',
    'EPMO_CI_WORKFLOW_RUN_ID:',
  ]) assert.ok(workflow.includes(marker), 'Missing SHA gate: '+marker);
  assert.ok(deploy.includes('git rev-parse HEAD'));
  assert.ok(deploy.includes('EPMO_CI_VERIFIED_SHA'));
});

test('production deploy requires pinned SSH trust and verified build and database safety',()=>{
  assert.ok(workflow.includes('EPMO_PROD_SSH_KNOWN_HOSTS'));
  assert.ok(workflow.includes('StrictHostKeyChecking=yes'));
  assert.ok(workflow.includes('environment: production'));
  assert.ok(deploy.includes('infra/backup-db.sh'));
  assert.ok(deploy.includes('rehearse-db-restore.sh'));
  assert.ok(deploy.includes('--backup-dir='));
  assert.ok(deploy.includes('--exclude .deployed-revision'));
  assert.ok(deploy.includes('build api web'));
});

test('deployment does not include an unguarded direct push trigger or bypass check',()=>{
  assert.ok(workflow.includes('workflow_run:'));
  assert.ok(!/^\s+push:\s*$/m.test(workflow));
  assert.ok(!workflow.includes('StrictHostKeyChecking=no'));
  assert.ok(!deploy.includes('SKIP_TESTS=true'));
});

test('successful deployment records exactly one validated revision marker',()=>{
  const section = workflow.split('      - name: Deploy and record the verified production revision\n')[1];
  assert.ok(section, 'Missing revision recording step');
  assert.equal((section.match(/\.deployed-revision/g) || []).length,1);
  assert.ok(section.includes("SHA_PATTERN='^[a-f0-9]{40}$'"));
  assert.ok(section.includes('[[ "$EPMO_CI_VERIFIED_SHA" =~ $SHA_PATTERN ]]'));
  assert.match(section, /bash infra\/deploy\.sh prod[\s\S]*ssh [\s\S]*\.deployed-revision/);
  assert.ok(section.includes('StrictHostKeyChecking=yes'));
});

test('superseded releases are filtered before creating a production deployment',()=>{
  const preflight = workflow.split('  preflight:\n')[1]?.split('  deploy:\n')[0];
  assert.ok(preflight);
  assert.ok(!preflight.includes('environment: production'));
  assert.ok(preflight.includes('current=false'));
  assert.ok(preflight.includes('current=true'));
  const production = workflow.split('  deploy:\n')[1];
  assert.ok(production.includes('needs: preflight'));
  assert.ok(production.includes("needs.preflight.outputs.current == 'true'"));
  assert.ok(production.includes('Refuse to deploy stale or superseded commits'));
});

test('self-hosted production deployment safely reclaims only regenerable runner caches before artifact download',()=>{
  const cache = workflow.indexOf('name: Reclaim regenerable runner package caches before artifact download');
  const download = workflow.indexOf('name: Download images from the exact successful CI run');
  const headroom = workflow.indexOf('name: Require headroom for verified image deployment on self-hosted runner');
  assert.ok(cache >= 0 && cache < download && download < headroom);
  const section = workflow.slice(cache,download);
  assert.match(section,/npm cache clean --force/);
  assert.match(section,/pnpm store prune/);
  assert.doesNotMatch(section,/docker (?:system|image|volume|container) prune|rm -rf|journalctl|find .* -delete/);
  assert.match(workflow.slice(headroom),/minimum_kib=\$\(\(2 \* 1024 \* 1024\)\)/);
});
