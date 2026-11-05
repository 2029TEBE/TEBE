import { Injectable, ConflictException, NotFoundException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { EVALUATION_PLAN_CODE, effectiveEvaluationStatus } from './evaluation-policy';
import { sql } from 'drizzle-orm';
import { withTenant } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';

const rows = (value: unknown) => value as any[];
@Injectable()
export class SubscriptionService {
  async plans() {
    const { tenantId } = currentContext();
    return withTenant(tenantId, async tx => rows(await tx.execute(sql`
      SELECT code, name, price_minor AS "priceMinor", currency,
             billing_interval AS "billingInterval", trial_days AS "trialDays"
      FROM subscription_plans WHERE is_active = true ORDER BY price_minor, code`)));
  }
  async current() {
    const { tenantId } = currentContext();
    const result = await withTenant(tenantId, async tx => rows(await tx.execute(sql`
      SELECT s.id, s.status, s.period_starts_at AS "periodStartsAt",
             s.period_ends_at AS "periodEndsAt", s.trial_ends_at AS "trialEndsAt",
             s.cancel_at_period_end AS "cancelAtPeriodEnd", p.code AS "planCode",
             p.name AS "planName", p.price_minor AS "priceMinor",
             p.currency, p.billing_interval AS "billingInterval"
      FROM tenant_subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.tenant_id = ${tenantId} ORDER BY s.created_at DESC, s.id DESC LIMIT 1`)));
    const current = result[0] ?? null;
    if (current?.planCode !== EVALUATION_PLAN_CODE) return current;
    return { ...current, status: effectiveEvaluationStatus(current),
      requiresCard: false, renewsAutomatically: false,
      upgradeAvailable: true, demoData: 'fictional' };
  }
  /** One-time no-card Evaluation for an existing, empty tenant. */
  async startEvaluation() {
    requireCapability('pmoa_admin');
    if (process.env.EVALUATION_ACCESS_ENABLED !== 'true' ||
        process.env.DEPLOYMENT_ENV === 'production')
      throw new ServiceUnavailableException('Evaluation signup is not enabled');
    const { tenantId, userId } = currentContext();
    if (!userId) throw new ForbiddenException('Authenticated tenant administrator required');
    return withTenant(tenantId, async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(1212,hashtext(${tenantId}))`);
      const prior = rows(await tx.execute(sql`
        SELECT
          EXISTS(SELECT 1 FROM tenant_evaluation_trials WHERE tenant_id=${tenantId}) AS "usedTrial",
          EXISTS(SELECT 1 FROM tenant_subscriptions WHERE tenant_id=${tenantId}) AS "hasSubscription",
          (EXISTS(SELECT 1 FROM portfolios WHERE tenant_id=${tenantId}) OR
           EXISTS(SELECT 1 FROM programs WHERE tenant_id=${tenantId}) OR
           EXISTS(SELECT 1 FROM projects WHERE tenant_id=${tenantId})) AS "hasProjects",
          EXISTS(SELECT 1 FROM tenant_modules
                 WHERE tenant_id=${tenantId} AND enabled=true AND module_id <> 'core360') AS "hasModuleLicences"`))[0];
      if (!prior || prior.usedTrial || prior.hasSubscription ||
          prior.hasProjects || prior.hasModuleLicences)
        throw new ConflictException('Evaluation requires a new empty workspace with no earlier subscription or trial');
      const plan = rows(await tx.execute(sql`
        SELECT id, price_minor AS "priceMinor", trial_days AS "trialDays",
               is_active AS "isActive"
        FROM subscription_plans WHERE code=${EVALUATION_PLAN_CODE} LIMIT 1`))[0];
      if (!plan || !plan.isActive || Number(plan.priceMinor)!==0 || Number(plan.trialDays)!==7)
        throw new ServiceUnavailableException('The free Evaluation plan is not configured');
      const created = rows(await tx.execute(sql`
        INSERT INTO tenant_subscriptions
          (tenant_id,plan_id,status,period_starts_at,period_ends_at,
           trial_ends_at,cancel_at_period_end)
        VALUES (${tenantId},${plan.id},'trialing',
          now(),now()+interval '168 hours',now()+interval '168 hours',true)
        RETURNING id,period_starts_at AS "startedAt",trial_ends_at AS "expiresAt"`))[0];
      if (!created) throw new ServiceUnavailableException('Could not create Evaluation');
      await tx.execute(sql`
        INSERT INTO tenant_evaluation_trials
          (tenant_id,subscription_id,started_by,started_at,expires_at)
        VALUES (${tenantId},${created.id},${userId},
          ${created.startedAt}::timestamptz,${created.expiresAt}::timestamptz)`);
      // Limited demo licensing is bounded by the immutable trial timestamp.
      await tx.execute(sql`
        INSERT INTO tenant_modules
          (tenant_id,module_id,enabled,tier,expires_at,enabled_at)
        SELECT ${tenantId},m.id,true,'trial'::licence_tier,
               ${created.expiresAt}::timestamptz,now()
        FROM modules m WHERE m.id IN ('core360','pmo360','analytics360','risk360')
        ON CONFLICT (tenant_id,module_id) DO UPDATE SET
          enabled=true,tier='trial'::licence_tier,
          expires_at=EXCLUDED.expires_at,enabled_at=now()`);
      // Fictional examples in a new tenant; never mix with customer projects.
      const portfolio = rows(await tx.execute(sql`
        INSERT INTO portfolios(tenant_id,name,description,health)
        VALUES (${tenantId},'[DEMO] Transformation Portfolio',
          'Fictional evaluation sample. No real customer data.','at_risk')
        RETURNING id`))[0];
      const program = rows(await tx.execute(sql`
        INSERT INTO programs(tenant_id,portfolio_id,name,description,health)
        VALUES (${tenantId},${portfolio.id},'[DEMO] Strategy Delivery Program',
          'Synthetic projects for Evaluation only.','at_risk') RETURNING id`))[0];
      const project = rows(await tx.execute(sql`
        INSERT INTO projects(tenant_id,program_id,code,name,status,health,progress_pct)
        VALUES (${tenantId},${program.id},'EVAL-01',
          '[DEMO] Service Improvement Pilot','active','at_risk',42) RETURNING id`))[0];
      await tx.execute(sql`
        INSERT INTO projects(tenant_id,program_id,code,name,status,health,progress_pct)
        VALUES (${tenantId},${program.id},'EVAL-02',
          '[DEMO] Performance Reporting Rollout','active','on_track',70)`);
      await tx.execute(sql`
        INSERT INTO raid_items(tenant_id,project_id,kind,title,detail,severity,likelihood,status)
        VALUES (${tenantId},${project.id},'risk',
          '[DEMO] Sample dependency risk',
          'Fictional register item for Evaluation only.',3,2,'mitigating')`);
      await tx.execute(sql`
        INSERT INTO subscription_events(tenant_id,subscription_id,actor_user_id,event_type,details)
        VALUES (${tenantId},${created.id},${userId},'evaluation.started',
          '{"paymentVerified":false,"paymentMethodRequired":false,"autoRenew":false,"fictionalData":true}'::jsonb)`);
      await tx.execute(sql`
        INSERT INTO audit_events(tenant_id,actor_id,entity,entity_id,action,diff)
        VALUES (${tenantId},${userId},'evaluation',${created.id},'evaluation.started',
          '{"durationHours":168,"priceMinor":0,"currency":"SAR"}'::jsonb)`);
      return {
        subscriptionId:created.id,planCode:EVALUATION_PLAN_CODE,status:'trialing',
        startedAt:created.startedAt,expiresAt:created.expiresAt,
        requiresCard:false,renewsAutomatically:false,priceMinor:0,currency:'SAR',
        demoData:'fictional',paymentVerified:false,
      };
    });
  }

  async setCancellation(cancel: boolean) {
    requireCapability('pmoa_admin');
    const { tenantId, userId } = currentContext();
    return withTenant(tenantId, async tx => {
      // A row lock makes the eligibility check and update atomic.
      const result = rows(await tx.execute(sql`
        SELECT id, status, period_ends_at AS "periodEndsAt", cancel_at_period_end AS "cancelAtPeriodEnd"
        FROM tenant_subscriptions WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`));
      const current = result[0];
      if (!current) throw new NotFoundException('No subscription');
      if (!['active', 'trialing'].includes(current.status) || new Date(current.periodEndsAt) <= new Date())
        throw new ConflictException('Subscription cannot be changed in its current state');
      // Replayed requests must not create fictitious preference changes or extra audit rows.
      if (current.cancelAtPeriodEnd === cancel)
        return { id: current.id, cancelAtPeriodEnd: cancel, unchanged: true };
      await tx.execute(sql`UPDATE tenant_subscriptions SET cancel_at_period_end = ${cancel}, updated_at = now()
        WHERE tenant_id = ${tenantId} AND id = ${current.id}`);
      await tx.execute(sql`INSERT INTO subscription_events
        (tenant_id, subscription_id, actor_user_id, event_type, details)
        VALUES (${tenantId}, ${current.id}, ${userId}, ${cancel ? 'cancellation.scheduled' : 'cancellation.resumed'}, '{}'::jsonb)`);
      return { id: current.id, cancelAtPeriodEnd: cancel };
    });
  }
  /** Administrative subscription timeline, restricted to the authenticated tenant. */
  async history() {
    requireCapability('pmoa_admin');
    const { tenantId } = currentContext();
    return withTenant(tenantId, async tx => rows(await tx.execute(sql`
      SELECT s.id, p.code AS "planCode", s.status,
             s.period_starts_at AS "periodStartsAt", s.period_ends_at AS "periodEndsAt",
             s.trial_ends_at AS "trialEndsAt", s.cancel_at_period_end AS "cancelAtPeriodEnd",
             s.created_at AS "createdAt"
      FROM tenant_subscriptions s
      JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.tenant_id = ${tenantId}
      ORDER BY s.created_at DESC, s.id DESC LIMIT 100`)));
  }

  /** Auditable tenant-only subscription activity; never trusts a caller-supplied tenant id. */
  async events() {
    requireCapability('pmoa_admin');
    const { tenantId } = currentContext();
    return withTenant(tenantId, async tx => rows(await tx.execute(sql`
      SELECT e.id, e.subscription_id AS "subscriptionId", e.event_type AS "eventType",
             e.actor_user_id AS "actorUserId", e.details, e.created_at AS "createdAt"
      FROM subscription_events e WHERE e.tenant_id = ${tenantId}
      ORDER BY e.created_at DESC, e.id DESC LIMIT 100`)));
  }

}
