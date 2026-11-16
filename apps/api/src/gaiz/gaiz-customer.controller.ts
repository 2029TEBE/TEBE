import { Controller, Get, NotFoundException, ForbiddenException, UnauthorizedException, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';
import { currentContext } from '../tenancy/tenant-context';

/**
 * Read-only EPMO session/tenant preflight. NOT a GAIZ customer onboarding,
 * marketplace identity, licensing, file access or enterprise import endpoint.
 *
 * Explicitly disabled until an operator enables this feature on an approved
 * environment. No session tokens, tenant keys or issuer keys are returned.
 */
@Controller('api/v1/gaiz/customer')
export class GaizCustomerController {
  constructor(private readonly auth: AuthService) {}

  @Get('session')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async session(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Cookie');

    if (process.env.GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED !== 'true') {
      throw new NotFoundException();
    }

    // Require an actual authenticated cookie, never development header auth.
    const cookie = req.cookies?.[SESSION_COOKIE];
    if (typeof cookie !== 'string' || !cookie) {
      throw new UnauthorizedException('Sign in to your EPMO account.');
    }
    const principal = await this.auth.principal(cookie);
    if (!principal) {
      throw new UnauthorizedException('Your session has expired.');
    }

    // TenantMiddleware establishes request scope from server-side membership;
    // neither headers nor GAIZ manifests can select or override it here.
    const context = currentContext();
    if (!context.userId ||
        context.userId !== principal.userId ||
        context.tenantId !== principal.tenantId) {
      throw new ForbiddenException('Session does not match the active workspace.');
    }

    // Minimal truthful response: existing EPMO authentication only.
    // Never infer GAIZ purchases, tenant imports or issuer trust from sign-in.
    return {
      authenticated: true,
      tenantBound: true,
      tenantId: principal.tenantId,
      identityProvider: 'epmo-session',
      verificationLevel: 'authenticated-workspace-session',
      gaizEntitled: false,
      gaizDownloadAuthorized: false,
      gaizImportAuthorized: false,
      gaizIssuerVerified: false,
    } as const;
  }
}
