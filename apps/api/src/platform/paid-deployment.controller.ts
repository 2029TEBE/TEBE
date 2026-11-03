import { Controller, Get, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { withTenant } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { assertRuntimeDeploymentTenant, parseRuntimeDeployment } from '../tenancy/deployment-runtime';

/**
 * Running NestJS endpoint, unlike the standalone E76 HTTP adapter.
 * Session identity is established by TenantMiddleware and AsyncLocalStorage;
 * never accept a tenant, payment status or deployment from request headers.
 *
 * A subscription row is NOT a provider receipt: staging must separately prove
 * that only verified settlement can activate it. This endpoint fails closed
 * when the deployment inventory is absent.
 */
@Controller('api/v1/platform/deployment')
export class PaidDeploymentController {
  @Get('paid-access')
  async paidAccess() {
    const { tenantId, userId } = currentContext();
    if (!userId) throw new ForbiddenException('Access unavailable');
    const runtime = parseRuntimeDeployment(process.env);
    if (!runtime) throw new ServiceUnavailableException('Deployment unavailable');
    try {
      assertRuntimeDeploymentTenant(runtime, { tenantId, userId });
      const binding = runtime.tenantBindings.get(tenantId);
      if (!binding) throw new Error('Unbound tenant');
      const result = await withTenant(tenantId, tx => tx.execute(sql`
        SELECT id FROM tenant_subscriptions
        WHERE tenant_id = ${tenantId}
          AND status = 'active'
          AND period_starts_at <= now()
          AND period_ends_at > now()
        ORDER BY created_at DESC, id DESC LIMIT 1
      `));
      if (!Array.isArray(result) || result.length !== 1)
        throw new Error('No active paid entitlement');
      return {
        deploymentId: runtime.deploymentId,
        profile: runtime.profile,
        region: runtime.region,
        apiOrigin: runtime.apiOrigin,
      };
    } catch {
      // No database error, subscription IDs, tenant IDs or token details leak.
      throw new ForbiddenException('Access unavailable');
    }
  }
}
