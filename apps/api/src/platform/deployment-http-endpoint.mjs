import { resolvePostgresDeployment } from './postgres-deployment-adapter.mjs';

// Transport-neutral HTTP handler: authentication must be completed by the
// host application. Never derive principal identity from request headers/body.
export function createDeploymentEndpoint({ db, approvedOrigins, authenticate }) {
  if (typeof authenticate !== 'function' || !db || !Array.isArray(approvedOrigins))
    throw new TypeError('Deployment endpoint configuration invalid');
  return async function deploymentEndpoint(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const principal = await authenticate(request);
      if (!principal || principal.authenticated !== true) {
        response.statusCode = 401;
        response.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      const deployment = await resolvePostgresDeployment({
        db, session: principal, approvedOrigins
      });
      response.statusCode = 200;
      response.end(JSON.stringify({
        deploymentId: deployment.deploymentId,
        profile: deployment.profile,
        region: deployment.region,
        apiOrigin: deployment.apiOrigin
      }));
    } catch {
      // Do not reflect exceptions, tokens, SQL, cookies or user identifiers.
      response.statusCode = 403;
      response.end(JSON.stringify({ error: 'Deployment unavailable' }));
    }
  };
}
