import { resolveTrustedDeployment, DeploymentRoutingError } from './trusted-deployment-routing.mjs';

// The database adapter MUST use a trusted, authenticated session and return only
// rows visible to the authenticated principal. Never use request-provided tenant,
// deployment, region, or origin as a lookup key.
export async function resolveDeploymentForSession({ session, loadMembership, loadBinding, loadRegistry, approvedOrigins }) {
  const deny = () => { throw new DeploymentRoutingError(); };
  if (!session || session.authenticated !== true ||
      typeof session.userId !== 'string' || typeof session.tenantId !== 'string' ||
      typeof loadMembership !== 'function' || typeof loadBinding !== 'function' ||
      typeof loadRegistry !== 'function') deny();
  try {
    const membership = await loadMembership(session.userId, session.tenantId);
    if (!membership || membership.userId !== session.userId ||
        membership.tenantId !== session.tenantId || membership.active !== true) deny();
    const binding = await loadBinding(session.tenantId);
    if (!binding || binding.tenantId !== session.tenantId ||
        binding.immutable !== true) deny();
    const registry = await loadRegistry(binding.deploymentId);
    return resolveTrustedDeployment({
      principal: { authenticated: true, userId: session.userId,
        tenantId: session.tenantId, membershipActive: true },
      binding, registry, approvedOrigins
    });
  } catch {
    // Uniform error prevents leaking membership, tenant, registry and origin details.
    deny();
  }
}
