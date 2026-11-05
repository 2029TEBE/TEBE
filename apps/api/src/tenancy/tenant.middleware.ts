import { ForbiddenException, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { withTenant } from '@pmo/db';
import { effectiveEvaluationStatus, isEvaluationRecoveryRead } from '../platform/evaluation-policy';
import type { Request, Response, NextFunction } from 'express';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';
import { runWithContext } from './tenant-context';

/**
 * Establishes who is calling, from a signed-in session — not from headers.
 *
 * Temporary header authentication is allowed ONLY on a loopback connection
 * in local development, with explicit opt-in. Staging and production cannot
 * impersonate a member even if NODE_ENV is misconfigured.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  /** All API modules, including core and undecorated routes, close at expiry.
   * A newer independently verified paid subscription ends this restriction.
   */
  private async enforceEvaluationExpiry(req: Request, tenantId: string) {
    const records = await withTenant(tenantId, tx => tx.execute(sql`
      SELECT p.code AS "planCode",s.status,
             s.period_starts_at AS "periodStartsAt",
             s.period_ends_at AS "periodEndsAt",
             s.trial_ends_at AS "trialEndsAt"
      FROM tenant_evaluation_trials e
      JOIN tenant_subscriptions s
        ON s.id=e.subscription_id AND s.tenant_id=e.tenant_id
      JOIN subscription_plans p ON p.id=s.plan_id
      WHERE e.tenant_id=${tenantId}
        AND s.id=(SELECT latest.id FROM tenant_subscriptions latest
                  WHERE latest.tenant_id=${tenantId}
                  ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1)
      LIMIT 1`)) as unknown as Array<{
        planCode: string; status: string; periodStartsAt: Date;
        periodEndsAt: Date; trialEndsAt: Date;
      }>;
    if (records[0] &&
        effectiveEvaluationStatus(records[0]) !== 'trialing' &&
        !isEvaluationRecoveryRead(req.method, req.path))
      throw new ForbiddenException('Evaluation access expired. Review your subscription to upgrade.');
  }

  async use(req: Request, _res: Response, next: NextFunction) {
    const p = await this.auth.principal(req.cookies?.[SESSION_COOKIE]);
    if (p) {
      await this.enforceEvaluationExpiry(req,p.tenantId);
      return runWithContext(
        { tenantId: p.tenantId, userId: p.userId, role: p.role as any,
          capabilities: p.capabilities as any }, () => next());
    }

    if (process.env.NODE_ENV === 'development' &&
        (!process.env.DEPLOYMENT_ENV || process.env.DEPLOYMENT_ENV === 'development') &&
        process.env.ALLOW_HEADER_AUTH === 'true' &&
        ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) {
      const tenantId = req.header('x-tenant-id');
      const userId = req.header('x-user-id') ?? null;
      if (tenantId) {
        const { and, eq } = await import('drizzle-orm');
        const { withTenant, memberships } = await import('@pmo/db');
        if (!userId) throw new UnauthorizedException('Development header authentication requires a user ID');
        let role: any = 'viewer';
        {
          const [m] = await withTenant(tenantId, (tx) =>
            tx.select({ role: memberships.role }).from(memberships)
              .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId), eq(memberships.isActive, true))).limit(1));
          if (!m) throw new UnauthorizedException('User is not a member of this tenant');
          role = m.role;
        }
        await this.enforceEvaluationExpiry(req,tenantId);
        return runWithContext({ tenantId, userId, role, capabilities: [] }, () => next());
      }
    }

    throw new UnauthorizedException('Not signed in');
  }
}
