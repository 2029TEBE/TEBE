// Fail-closed deployment routing primitive. The caller must supply a verified server-side principal
// and a registry record loaded by tenant ID from a trusted database, never request headers.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILES = new Set(['shared_sa', 'dedicated_sa']);
const REGIONS = new Set(['sa-east-1', 'me-central2']);
export class DeploymentRoutingError extends Error {
  constructor() { super('Deployment unavailable'); this.name = 'DeploymentRoutingError'; }
}
export function resolveTrustedDeployment({ principal, binding, registry, approvedOrigins }) {
  const reject = () => { throw new DeploymentRoutingError(); };
  if (!principal?.authenticated || !UUID.test(principal.tenantId ?? '') ||
      !UUID.test(principal.userId ?? '') || principal.membershipActive !== true) reject();
  if (!binding || binding.tenantId !== principal.tenantId ||
      !UUID.test(binding.deploymentId ?? '') || binding.immutable !== true) reject();
  if (!registry || registry.id !== binding.deploymentId ||
      registry.tenantId !== principal.tenantId ||
      !PROFILES.has(registry.profile) || !REGIONS.has(registry.region) ||
      registry.status !== 'active') reject();
  if (!Array.isArray(approvedOrigins) || !approvedOrigins.includes(registry.apiOrigin)) reject();
  let url;
  try { url = new URL(registry.apiOrigin); } catch { reject(); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/' ||
      !url.hostname.endsWith('.theepmo.com')) reject();
  return Object.freeze({ deploymentId: registry.id, profile: registry.profile,
    region: registry.region, apiOrigin: url.origin });
}
