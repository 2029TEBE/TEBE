/**
 * E66: isolated, synthetic-only staging RLS operator probe.
 * Read/write probes are restricted to explicit synthetic fixture IDs; all
 * writes roll back. This does not grant independent staging gate approval.
 */
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/;
const ROLLBACK = Symbol('e66-rollback');
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

export function validateStagingRlsConfig(env, checkoutSha) {
  if (env.DEPLOYMENT_ENV !== 'staging' || env.NODE_ENV === 'production' ||
      env.EPMO_STAGING_RLS_CONFIRM !== 'YES_AUTHORIZED_SYNTHETIC_STAGING_RLS' ||
      env.EPMO_STAGING_RLS_SYNTHETIC_FIXTURES !== 'YES_ISOLATED_SYNTHETIC_TENANTS' ||
      !SHA.test(checkoutSha || '') || env.EPMO_STAGING_RLS_SOURCE_SHA !== checkoutSha ||
      env.EPMO_STAGING_RLS_DEPLOYED_SHA !== checkoutSha) fail('CONFIG');
  let url;
  try { url = new URL(env.EPMO_STAGING_RLS_DB_URL); } catch { fail('CONFIG'); }
  // A dedicated, operator-established encrypted local tunnel is mandatory.
  // Never connect this runner directly to a public or production DB endpoint.
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.port !== '15433' || url.username !== 'pmo_app' || !url.password ||
      url.pathname !== '/pmo' || url.search || url.hash) fail('CONFIG');
  const ids = {
    tenantA: env.EPMO_STAGING_RLS_TENANT_A_ID,
    tenantB: env.EPMO_STAGING_RLS_TENANT_B_ID,
    projectA: env.EPMO_STAGING_RLS_PROJECT_A_ID,
    projectB: env.EPMO_STAGING_RLS_PROJECT_B_ID,
  };
  if (Object.values(ids).some(id => !UUID.test(id || '')) ||
      new Set(Object.values(ids).map(id => id.toLowerCase())).size !== 4) fail('CONFIG');
  return { dbUrl: env.EPMO_STAGING_RLS_DB_URL, sourceSha: checkoutSha, ids };
}

async function visibleProject(db, tenant, project) {
  return db.begin(async tx => {
    await tx.unsafe('SET TRANSACTION READ ONLY');
    await tx.unsafe("SELECT set_config('app.tenant_id', $1, true)", [tenant || '']);
    return tx.unsafe('SELECT id, tenant_id FROM public.projects WHERE id = $1', [project]);
  });
}
function expectOwn(rows, project, tenant) {
  if (rows.length !== 1 || !same(rows[0].id, project) || !same(rows[0].tenant_id, tenant)) fail('FIXTURE');
}
async function rollbackOnly(db, fn) {
  let reachedEnd = false;
  try {
    await db.begin(async tx => {
      await tx.unsafe("SELECT set_config('statement_timeout', '10000', true)");
      await fn(tx);
      reachedEnd = true;
      throw ROLLBACK;
    });
    fail('ROLLBACK');
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
  if (!reachedEnd) fail('ROLLBACK');
}

export async function runStagingRlsProbe(db, ids) {
  const role = await db.unsafe('SELECT current_user AS "dbRole", (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser, (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass');
  if (role.length !== 1 || role[0].dbRole !== 'pmo_app' ||
      role[0].superuser !== false || role[0].bypass !== false) fail('ROLE');
  expectOwn(await visibleProject(db, ids.tenantA, ids.projectA), ids.projectA, ids.tenantA);
  expectOwn(await visibleProject(db, ids.tenantB, ids.projectB), ids.projectB, ids.tenantB);
  if ((await visibleProject(db, '', ids.projectA)).length ||
      (await visibleProject(db, ids.tenantA, ids.projectB)).length ||
      (await visibleProject(db, ids.tenantB, ids.projectA)).length) fail('FOREIGN_READ');

  await rollbackOnly(db, async tx => {
    await tx.unsafe("SELECT set_config('app.tenant_id', $1, true)", [ids.tenantA]);
    const own = await tx.unsafe('UPDATE public.projects SET name = name WHERE id = $1 RETURNING id', [ids.projectA]);
    if (own.length !== 1 || !same(own[0].id, ids.projectA)) fail('OWN_WRITE');
    const code = 'E66-' + randomUUID().slice(0, 8);
    const inserted = await tx.unsafe('INSERT INTO public.projects (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING id', [ids.tenantA, code, 'Synthetic staging rollback probe']);
    if (inserted.length !== 1) fail('OWN_WRITE');
    if ((await tx.unsafe('UPDATE public.projects SET name = name WHERE id = $1 RETURNING id', [ids.projectB])).length ||
        (await tx.unsafe('DELETE FROM public.projects WHERE id = $1 RETURNING id', [ids.projectB])).length) fail('FOREIGN_WRITE');
    await tx.unsafe('SAVEPOINT e66_foreign');
    let denied = false;
    try {
      await tx.unsafe('INSERT INTO public.projects (tenant_id, code, name) VALUES ($1, $2, $3)', [ids.tenantB, code + '-foreign', 'Must be denied']);
    } catch (error) { denied = error?.code === '42501'; }
    if (!denied) fail('FOREIGN_INSERT');
    await tx.unsafe('ROLLBACK TO SAVEPOINT e66_foreign');
  });

  if ((await visibleProject(db, '', ids.projectA)).length ||
      (await visibleProject(db, ids.tenantA, ids.projectB)).length) fail('REPLAY');
  expectOwn(await visibleProject(db, ids.tenantB, ids.projectB), ids.projectB, ids.tenantB);
  expectOwn(await visibleProject(db, ids.tenantA, ids.projectA), ids.projectA, ids.tenantA);
  if ((await visibleProject(db, '', ids.projectB)).length) fail('REPLAY');
  return ['restricted non-BYPASSRLS pmo_app', 'two explicit synthetic tenants',
    'foreign/no-tenant SELECT denied', 'own UPDATE/INSERT rolled back',
    'foreign UPDATE/DELETE denied', 'foreign INSERT rejected by RLS',
    'A/B/A replay denied', 'zero probe writes committed'];
}

export function safeStagingRlsFailure(error) {
  const allowed = new Set(['CONFIG', 'ROLE', 'FIXTURE', 'FOREIGN_READ', 'OWN_WRITE',
    'FOREIGN_WRITE', 'FOREIGN_INSERT', 'REPLAY', 'ROLLBACK']);
  return 'BLOCKED E66 staging RLS: ' + (allowed.has(error?.code) ? error.code : 'DATABASE');
}

async function main() {
  try {
    const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 5000 }).trim();
    const config = validateStagingRlsConfig(process.env, checkoutSha);
    const requireDb = createRequire(new URL('../packages/db/package.json', import.meta.url));
    const imported = requireDb('postgres');
    const postgres = typeof imported === 'function' ? imported : imported?.default;
    if (typeof postgres !== 'function') fail('DATABASE');
    const db = postgres(config.dbUrl, { max: 1, connect_timeout: 10, idle_timeout: 5 });
    let checks;
    try { checks = await runStagingRlsProbe(db, config.ids); }
    finally { await db.end(); }
    console.log(JSON.stringify({ gate: 'tenant_rls', sourceSha: checkoutSha,
      environment: 'operator-asserted-isolated-synthetic-staging',
      result: 'PROBE_PASS_REVIEW_PENDING', checks,
      independentlyReviewed: false, deployedShaIndependentlyAttested: false,
      releaseAccepted: false, secretMaterialIncluded: false,
      executedAtUtc: new Date().toISOString() }));
  } catch (error) {
    console.error(safeStagingRlsFailure(error));
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
