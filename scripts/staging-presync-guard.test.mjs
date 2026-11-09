import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../infra/deploy.sh', import.meta.url), 'utf8');

test('staging config must be validated remotely before rsync --delete', () => {
  const preflight = script.indexOf("node scripts/verify-staging-config.mjs --env-file '$ENVFILE'");
  const sync = script.indexOf('rsync -az --delete');
  const backup = script.indexOf("infra/backup-db.sh '$MODE'");
  assert.ok(preflight > 0, 'remote staging preflight must exist');
  assert.ok(sync > preflight, 'staging preflight must run before rsync');
  assert.ok(backup > sync, 'backup is triggered only after preflight and sync');
});

test('pre-sync validation fails closed, only in staging', () => {
  assert.match(script, /if \[\[ "\$MODE" == staging \]\]; then\s+if ! ssh_remote "cd '\$DIR' && test -f scripts\/verify-staging-config\.mjs && node scripts\/verify-staging-config\.mjs --env-file '\$ENVFILE'"; then/);
  assert.match(script, /No files copied\.' >&2\s+exit 1/);
});

test('pre-sync gate has no production keys or hidden bypass flags', () => {
  const section = script.slice(script.indexOf('# A staging target is not safe'), script.indexOf('echo "Deploying $MODE'));
  assert.doesNotMatch(section, /StrictHostKeyChecking=no|curl\s+.*-k|rsync\s|--force|DEPLOYMENT_ENV=production/);
});
