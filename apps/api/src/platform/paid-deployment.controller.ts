import { Controller, Get, Header, ForbiddenException } from '@nestjs/common';
import { currentContext } from '../tenancy/tenant-context';
import { assertRuntimeDeploymentTenant, parseRuntimeDeployment } from '../tenancy/deployment-runtime';

/**
 * Paddle-only paid access is denied until immutable provider receipts,
 * subscription lifecycle and tenant-bound settlement are wired and verified.
 * A client-supplied status, checkout redirect, or historical record cannot
 * authorize a new paid deployment.
 */
@Controller('api/v1/platform/deployment')
export class PaidDeploymentController {
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @Get('paid-access')
  async paidAccess() {
    try {
      const { tenantId, userId } = currentContext();
      if (!tenantId || !userId) throw new Error('Missing authenticated tenant');
      const runtime = parseRuntimeDeployment(process.env);
      if (!runtime) throw new Error('Deployment inventory missing');
      assertRuntimeDeploymentTenant(runtime, { tenantId, userId });
      if (!runtime.tenantBindings.has(tenantId)) throw new Error('Unknown deployment binding');
      // Never return deployment metadata before a committed provider settlement.
      throw new Error('Paddle entitlement integration not accepted');
    } catch {
      throw new ForbiddenException('Access unavailable');
    }
  }
}
