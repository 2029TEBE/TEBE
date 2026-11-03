/**
 * Dependency-free audit of source-level database contract.
 *
 * Does not connect to PostgreSQL, rewrite migrations, or inspect user data.
 * The SQL-ledger integrity checker separately verifies every migration digest.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbRoot = resolve(root, 'packages/db');
const read = p => readFileSync(resolve(root, p), 'utf8');
const migrationDir = resolve(dbRoot, 'migrations');

function namesFrom(sqlOrTs, kind) {
  const regex = kind === 'typescript'
    ? /\bpgTable\s*\(\s*['"]([a-z][a-z0-9_]*)['"]/g
    : /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"?public"?\.)?"?([a-z][a-z0-9_]*)"?)/gi;
  return [...sqlOrTs.matchAll(regex)].map(match => match[1].toLowerCase());
}

export function assessDatabaseSource({
  schema, identity, onboarding, migrations, rls, client, seed, seedHelper, journal,
}) {
  const errors = [];
  const warnings = [];
  const declarations = [
    ...namesFrom(schema, 'typescript'),
    ...namesFrom(identity, 'typescript'),
    ...namesFrom(onboarding, 'typescript'),
  ];
  const dbTables = Object.values(migrations).flatMap(sql => namesFrom(sql, 'sql'));
  const duplicates = list => [...new Set(list.filter((name, i) => list.indexOf(name) !== i))];
  if (duplicates(declarations).length) errors.push('Duplicate Drizzle table declarations: ' + duplicates(declarations).join(', '));
  if (duplicates(dbTables).length) errors.push('Duplicate CREATE TABLE declarations: ' + duplicates(dbTables).join(', '));
  const missingModels = [...new Set(dbTables)].filter(name => !declarations.includes(name));
  const missingSql = [...new Set(declarations)].filter(name => !dbTables.includes(name));
  if (missingModels.length) errors.push('SQL tables missing from Drizzle schema: ' + missingModels.join(', '));
  if (missingSql.length) errors.push('Drizzle tables missing SQL migrations: ' + missingSql.join(', '));

  for (const [table, symbol] of [['tenant_profiles', 'tenantProfiles'], ['tenant_invitations', 'tenantInvitations']]) {
    if (!new RegExp(`export const ${symbol}\\s*=\\s*pgTable\\s*\\(\\s*['"]${table}['"]`).test(onboarding))
      errors.push(`Missing typed onboarding model: ${table}`);
    if (!new RegExp(`export\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from\\s*['"]\\./schema/onboarding['"]`).test(schema))
      errors.push(`Missing public export of ${table}`);
    if (!new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;[\\s\\S]*?ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`).test(migrations['0016_workspace_profiles_invitations.sql'] ?? ''))
      errors.push(`Onboarding migration does not enforce RLS: ${table}`);
    if (!schema.includes(`'${table}'`)) errors.push(`Missing tenant-scoped table inventory: ${table}`);
  }

  if (!/export \{ roleEnum, tenants, users, memberships \} from '\.\/schema\/identity';/.test(schema))
    errors.push('Identity barrel compatibility was removed');
  if (!/export const tenants = pgTable\('tenants'/.test(identity) ||
      !/export const users = pgTable\('users'/.test(identity) ||
      !/export const memberships = pgTable\('memberships'/.test(identity))
    errors.push('Global identities must remain in the dedicated module');
  if (!/db\.transaction\([\s\S]*?set_config\('app\.tenant_id',\s*\$\{tenantId\},\s*true\)/.test(client))
    errors.push('Tenant context is not transaction-local');
  if (!/ALTER TABLE %I FORCE ROW LEVEL SECURITY/.test(rls))
    errors.push('Tenant isolation no longer FORCEs PostgreSQL RLS');
  if (!/REVOKE INSERT, UPDATE, DELETE ON users FROM pmo_app/.test(rls) ||
      !/GRANT UPDATE \(failed_attempts, locked_until, last_login_at\) ON users TO pmo_app/.test(rls))
    errors.push('Global-user column-level restrictions missing');
  if (!/REVOKE ALL ON public\.auth_password_resets FROM pmo_app/.test(rls) ||
      !/REVOKE ALL ON FUNCTION public\.pmo_redeem_password_reset\(text, text\) FROM PUBLIC/.test(rls))
    errors.push('Password-recovery function or table grant guard missing');
  if (!/assertDisposableSeedSafety\(process\.env\)/.test(seed) ||
      !/assertDisposableSeedSafety\(process\.env\);[\s\S]*const adminUrl = process\.env\.DATABASE_URL_ADMIN/.test(seed))
    errors.push('Disposable seed safety guard must precede database access');
  if (!/writeDevEnv\(acme\.id, fatima\.id, adminUrl\)/.test(seed) ||
      !/localUrl !== adminUrl/.test(seedHelper))
    errors.push('Seed helper must verify the exact local admin URL');
  if (journal.entries?.length !== Object.keys(migrations).length)
    errors.push('Migrations do not match the SQL ledger count');

  // Known risks are reported, not silently claimed fixed in a no-DDL refactor.
  if (/GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pmo_app/.test(rls))
    warnings.push('Legacy broad table grants remain: design explicit table permissions before production RLS changes');
  if (/GRANT SELECT ON users TO pmo_app/.test(rls))
    warnings.push('Global users SELECT includes password_hash: plan carefully scoped authentication lookup');
  return { errors, warnings, declaredTables: declarations.length, sqlTables: dbTables.length };
}

export function inspectRepositoryDatabase() {
  const migrationNames = readdirSync(migrationDir).filter(f => /^\d{4}_[a-z0-9_]+\.sql$/.test(f));
  const migrations = Object.fromEntries(migrationNames.map(name => [name, read(`packages/db/migrations/${name}`)]));
  return assessDatabaseSource({
    schema: read('packages/db/src/schema.ts'),
    identity: read('packages/db/src/schema/identity.ts'),
    onboarding: read('packages/db/src/schema/onboarding.ts'),
    migrations,
    rls: read('packages/db/sql/rls.sql'),
    client: read('packages/db/src/client.ts'),
    seed: read('packages/db/src/seed.ts'),
    seedHelper: read('packages/db/src/seed/dev-env.ts'),
    journal: JSON.parse(read('packages/db/migrations/meta/_journal.json')),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = inspectRepositoryDatabase();
  console.log(`Database contract: ${report.declaredTables} Drizzle tables, ${report.sqlTables} SQL table declarations`);
  for (const warning of report.warnings) console.warn('REVIEW:', warning);
  for (const error of report.errors) console.error('FAIL:', error);
  if (report.errors.length) process.exitCode = 1;
  else console.log('PASS: source table inventory, tenant guards and historical SQL migration structure');
}
