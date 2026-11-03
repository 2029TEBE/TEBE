import { createDeploymentEndpoint } from './deployment-http-endpoint.mjs';

// A composable paid-access endpoint. The verifier MUST read a server-owned,
// cryptographically verified entitlement; never trust request JSON, cookies,
// headers or a client-provided "paid" flag.
export function createPaidDeploymentEndpoint({ db, approvedOrigins, authenticate, verifyEntitlement }) {
  if (typeof authenticate !== 'function' || typeof verifyEntitlement !== 'function')
    throw new TypeError('Paid deployment endpoint configuration invalid');

  return createDeploymentEndpoint({
    db, approvedOrigins,
    authenticate: async request => {
      const principal = await authenticate(request);
      if (!principal || principal.authenticated !== true ||
          typeof principal.userId !== 'string' || typeof principal.tenantId !== 'string')
        return null;

      // The entitlement verifier must bind its result to the server-authenticated
      // tenant, and must check current revocation/expiry and signature upstream.
      const entitlement = await verifyEntitlement({
        userId: principal.userId, tenantId: principal.tenantId
      });
      if (!entitlement || entitlement.verified !== true ||
          entitlement.active !== true || entitlement.revoked === true ||
          entitlement.tenantId !== principal.tenantId ||
          !Number.isSafeInteger(entitlement.expiresAtMs) ||
          entitlement.expiresAtMs <= Date.now()) return null;
      return principal;
    }
  });
}
