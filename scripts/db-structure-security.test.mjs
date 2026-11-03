import test from 'node:test';
import assert from 'node:assert/strict';
import { assessDatabaseSource, inspectRepositoryDatabase } from './verify-db-structure.mjs';
import { readFileSync } from 'node:fs';

const load = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const migrations = Object.fromEntries([
  '0000_initial_schema.sql', '0016_workspace_profiles_invitations.sql'
].map(n => [n, load('packages/db/migrations/' + n)]));
const sources = {
  schema: load('packages/db/src/schema.ts'),
  identity: load('packages/db/src/schema/identity.ts'),
  onboarding: load('packages/db/src/schema/onboarding.ts'),
  rls: load('packages/db/sql/rls.sql'),
  client: load('packages/db/src/client.ts'),
  seed: load('packages/db/src/seed.ts'),
  seedHelper: load('packages/db/src/seed/dev-env.ts'),
};

test('database schema and all SQL-ledger tables stay in sync', () => {
  const result = inspectRepositoryDatabase();
  assert.deepEqual(result.errors, [], result.errors.join('\n'));
  assert.ok(result.declaredTables >= 46);
});

test('onboarding table omission is detected before code merge', () => {
  const real = inspectRepositoryDatabase();
  assert.deepEqual(real.errors, []);
  const altered = assessDatabaseSource({
    ...sources,
    onboarding: sources.onboarding.replace(/pgTable\('tenant_invitations'/, "pgTable('invitations_without_tenant')"),
    migrations: { '0016_workspace_profiles_invitations.sql': migrations['0016_workspace_profiles_invitations.sql'] },
    journal: {entries: [{}]},
  });
  assert.match(altered.errors.join(' '), /tenant_invitations/);
});

test('tenant RLS and transaction-local context cannot silently regress', () => {
  const fake = assessDatabaseSource({
    ...sources, migrations: {'0016_workspace_profiles_invitations.sql': migrations['0016_workspace_profiles_invitations.sql']},
    journal: {entries:[{}]},
    rls: sources.rls.replace('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'ALTER TABLE %I ENABLE ROW LEVEL SECURITY'),
    client: sources.client.replace("set_config('app.tenant_id', ${tenantId}, true)", "set_config('app.tenant_id', ${tenantId}, false)"),
  });
  assert.match(fake.errors.join(' '), /FORCEs PostgreSQL RLS/);
  assert.match(fake.errors.join(' '), /transaction-local/);
});

test('security audit explicitly flags known broad grants rather than hiding risk', () => {
  const report = inspectRepositoryDatabase();
  assert.ok(report.warnings.some(w => w.includes('broad table grants')));
  assert.ok(report.warnings.some(w => w.includes('password_hash')));
});

test('seed must not access databases before disposable guard', () => {
  const fake = assessDatabaseSource({
    ...sources, migrations: {'0016_workspace_profiles_invitations.sql': migrations['0016_workspace_profiles_invitations.sql']},
    journal: {entries:[{}]},
    seed: sources.seed.replace('assertDisposableSeedSafety(process.env);', '// guard removed'),
  });
  assert.match(fake.errors.join(' '), /seed safety guard/);
});
