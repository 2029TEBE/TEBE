import { resolveDeploymentForSession } from './session-deployment-resolver.mjs';
import { DeploymentRoutingError } from './trusted-deployment-routing.mjs';

// Adapter contract: db.query(sql, parameters) must use a server-owned connection.
// Database role must have RLS enabled and must not possess BYPASSRLS.
// Never interpolate principal identifiers or accept deployment routing headers.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Fail closed unless the current database identity is a restricted login and
// every routing table has PostgreSQL RLS enabled. This is an independent
// runtime check, not a substitute for tenant-scoped RLS policy acceptance.
async function assertRestrictedRls(db) {
  const result = await db.query(`
    SELECT NOT r.rolsuper AND NOT r.rolbypassrls AS restricted,
           COUNT(c.oid) FILTER (WHERE c.relrowsecurity AND c.relforcerowsecurity) AS protected_count,
           COUNT(c.oid) AS table_count
    FROM pg_roles r
    CROSS JOIN (VALUES ('tenant_memberships'), ('tenant_deployment_bindings'),
                       ('tenant_deployments')) AS expected(name)
    LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || expected.name)
    WHERE r.rolname = current_user
    GROUP BY r.rolsuper, r.rolbypassrls
  `);
  const row = result?.rows?.[0];
  if (result?.rows?.length !== 1 || row?.restricted !== true ||
      Number(row.protected_count) !== 3 || Number(row.table_count) !== 3)
    throw new DeploymentRoutingError();
}

const one = async (db, sql, args) => {
  const result = await db.query(sql, args);
  if (!Array.isArray(result?.rows) || result.rows.length !== 1) throw new DeploymentRoutingError();
  return result.rows[0];
};
export async function resolvePostgresDeployment({ db, session, approvedOrigins }) {
  if (!db || typeof db.query !== 'function' ||
      !UUID.test(session?.userId ?? '') || !UUID.test(session?.tenantId ?? '') ||
      session?.authenticated !== true) throw new DeploymentRoutingError();
  try {
    await assertRestrictedRls(db);
    // Every query is scoped by authenticated server-owned tenant ID.
    return await resolveDeploymentForSession({
      session, approvedOrigins,
      loadMembership: async (userId, tenantId) => {
        const row = await one(db,
          'SELECT user_id, tenant_id, active FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2 AND active = TRUE LIMIT 2',
          [userId, tenantId]);
        return { userId: row.user_id, tenantId: row.tenant_id, active: row.active === true };
      },
      loadBinding: async tenantId => {
        const row = await one(db,
          'SELECT tenant_id, deployment_id, immutable FROM tenant_deployment_bindings WHERE tenant_id = $1 LIMIT 2',
          [tenantId]);
        return { tenantId: row.tenant_id, deploymentId: row.deployment_id, immutable: row.immutable === true };
      },
      loadRegistry: async deploymentId => {
        const row = await one(db,
          'SELECT id, tenant_id, profile, region, status, api_origin FROM tenant_deployments WHERE id = $1 AND tenant_id = $2 LIMIT 2',
          [deploymentId, session.tenantId]);
        return { id: row.id, tenantId: row.tenant_id, profile: row.profile,
          region: row.region, status: row.status, apiOrigin: row.api_origin };
      }
    });
  } catch {
    // No SQL, connection details, or tenant identifiers in public errors.
    throw new DeploymentRoutingError();
  }
}
