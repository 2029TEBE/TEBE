/**
 * E62: restricted-role, disposable-CI PostgreSQL negative READ/WRITE/replay proof.
 * Deliberately tests real RLS with no tenant WHERE predicate on reads.
 * Every write is inside a transaction that is ALWAYS rolled back.
 * This is not independent HTTPS staging or commercial release acceptance.
 */
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const OPT_IN = 'YES_DISPOSABLE_CI_RLS_NEGATIVE';
const ROLLBACK = Symbol('e62-always-rollback');
const fail = code => { const e = new Error(code); e.code = code; throw e; };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCiRlsConfig(env) {
  if (env.CI !== 'true' || env.GITHUB_ACTIONS !== 'true' ||
      env.NODE_ENV !== 'test' ||
      env.EPMO_CI_RLS_NEGATIVE !== OPT_IN ||
      env.PHASE15_ACCEPT_DISPOSABLE_DB !== 'YES_RESEED_DISPOSABLE_TEST_DATABASE')
    fail('CONFIG');
  let u;
  try { u = new URL(env.DATABASE_URL); } catch { fail('CONFIG'); }
  if (!['postgres:', 'postgresql:'].includes(u.protocol) ||
      u.username !== 'pmo_app' || !['localhost', '127.0.0.1'].includes(u.hostname) ||
      u.port !== '5433' || u.pathname !== '/pmo' || u.search || u.hash)
    fail('CONFIG');
  return { databaseUrl: env.DATABASE_URL };
}

export function assertRestrictedRole(rows) {
  if (!Array.isArray(rows) || rows.length !== 1 ||
      rows[0].dbRole !== 'pmo_app' || rows[0].superuser !== false ||
      rows[0].bypass !== false) fail('ROLE');
}

async function alwaysRollback(db, callback) {
  let finished = false;
  try {
    await db.begin(async tx => {
      await tx.unsafe("SELECT set_config('statement_timeout', '10000', true)");
      await callback(tx);
      finished = true;
      throw ROLLBACK;
    });
    fail('ROLLBACK');
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
  if (!finished) fail('ROLLBACK');
}

async function tenantContext(tx, tenant) {
  await tx.unsafe("SELECT set_config('app.tenant_id', $1, true)", [tenant || '']);
}
async function visibleProjects(db, tenant) {
  return db.begin(async tx => {
    await tx.unsafe('SET TRANSACTION READ ONLY');
    await tenantContext(tx, tenant);
    return tx.unsafe('SELECT id, tenant_id FROM public.projects ORDER BY id LIMIT 100');
  });
}
const sameId = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const assertRows = (rows, tenant, requirePositive = true) => {
  if (!Array.isArray(rows) || (requirePositive && rows.length === 0) ||
      rows.some(r => !uuid.test(r.id || '') || !sameId(r.tenant_id, tenant)))
    fail('READ');
};

export async function runRestrictedCiRlsNegative(db) {
  const role = await db.unsafe('SELECT current_user AS "dbRole", (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser, (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass');
  assertRestrictedRole(role);
  const tenants = await db.unsafe('SELECT id FROM public.tenants ORDER BY id LIMIT 20');
  if (!Array.isArray(tenants)) fail('FIXTURE');
  const populated = [];
  for (const row of tenants) {
    if (!uuid.test(row.id || '')) fail('FIXTURE');
    const projects = await visibleProjects(db, row.id);
    if (projects.length) {
      assertRows(projects, row.id);
      populated.push({ tenant: row.id, project: projects[0].id });
    }
    if (populated.length === 2) break;
  }
  if (populated.length !== 2 || sameId(populated[0].tenant, populated[1].tenant))
    fail('FIXTURE');
  const [a, b] = populated;
  const noTenant = await visibleProjects(db, null);
  if (noTenant.length) fail('READ');

  // Own-tenant writes must work (so a denied foreign write is meaningful).
  // UPDATE and INSERT are always rolled back, including if a later assertion fails.
  await alwaysRollback(db, async tx => {
    await tenantContext(tx, a.tenant);
    const own = await tx.unsafe('UPDATE public.projects SET name = name WHERE id = $1 RETURNING id', [a.project]);
    if (own.length !== 1 || !sameId(own[0].id, a.project)) fail('OWN_WRITE');
    const inserted = await tx.unsafe(
      'INSERT INTO public.projects (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING id',
      [a.tenant, 'E62-CI-ROLLBACK-ONLY', 'Disposable CI rollback probe']);
    if (inserted.length !== 1) fail('OWN_WRITE');

    // No tenant WHERE: database RLS must hide B even with an explicit B ID.
    const foreign = await tx.unsafe('SELECT id FROM public.projects WHERE id = $1', [b.project]);
    if (foreign.length) fail('READ');
    const updated = await tx.unsafe('UPDATE public.projects SET name = name WHERE id = $1 RETURNING id', [b.project]);
    if (updated.length) fail('FOREIGN_WRITE');
    const deleted = await tx.unsafe('DELETE FROM public.projects WHERE id = $1 RETURNING id', [b.project]);
    if (deleted.length) fail('FOREIGN_WRITE');

    // Savepoint makes a rejected INSERT recoverable without abandoning the
    // outer rollback-only transaction. An allowed foreign INSERT is a failure.
    await tx.unsafe('SAVEPOINT e62_foreign');
    let denied = false;
    try {
      await tx.unsafe('INSERT INTO public.projects (tenant_id, code, name) VALUES ($1, $2, $3)',
        [b.tenant, 'E62-CI-FOREIGN-DENY', 'Must never be inserted']);
    } catch (error) {
      denied = error?.code === '42501';
    }
    if (!denied) fail('FOREIGN_INSERT');
    await tx.unsafe('ROLLBACK TO SAVEPOINT e62_foreign');
  });

  // Transaction-local tenant context must not replay across a reused connection.
  const afterRollback = await visibleProjects(db, null);
  if (afterRollback.length) fail('REPLAY');
  const afterB = await visibleProjects(db, b.tenant);
  assertRows(afterB, b.tenant);
  if (!afterB.some(row => sameId(row.id, b.project))) fail('REPLAY');
  const afterA = await visibleProjects(db, a.tenant);
  assertRows(afterA, a.tenant);
  if (!afterA.some(row => sameId(row.id, a.project))) fail('REPLAY');
  if ((await visibleProjects(db, null)).length) fail('REPLAY');

  return { passed: true, scope: 'disposable-ci-only', checks: [
    'restricted role', 'two populated tenants', 'foreign read denied',
    'own update and insert permitted then rolled back',
    'foreign update and delete denied', 'foreign insert denied by RLS',
    'no-tenant and A/B/A replay denied', 'no writes committed'
  ] };
}

export function safeCiRlsFailure(error) {
  const known = new Set(['CONFIG', 'ROLE', 'FIXTURE', 'READ', 'OWN_WRITE',
    'FOREIGN_WRITE', 'FOREIGN_INSERT', 'REPLAY', 'ROLLBACK']);
  const code = known.has(error?.code) ? error.code : 'DATABASE';
  return 'BLOCKED E62 disposable CI RLS negative: ' + code;
}

async function main() {
  try {
    const config = validateCiRlsConfig(process.env);
    const requireDb = createRequire(new URL('../packages/db/package.json', import.meta.url));
    const exported = requireDb('postgres');
    const postgres = typeof exported === 'function' ? exported : exported?.default;
    if (typeof postgres !== 'function') fail('DATABASE');
    const db = postgres(config.databaseUrl, { max: 1, connect_timeout: 10 });
    try {
      const result = await runRestrictedCiRlsNegative(db);
      console.log('PASS E62 disposable CI restricted-role PostgreSQL RLS: ' + result.checks.length + ' checks');
      console.log('LIMIT: Not staging/provider acceptance; every probe write was rolled back.');
    } finally { await db.end(); }
  } catch (error) {
    console.error(safeCiRlsFailure(error));
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
