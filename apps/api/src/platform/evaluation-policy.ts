/** One-time, nonrenewing, card-free Evaluation access. Never linked to Paddle. */
export const EVALUATION_PLAN_CODE = 'evaluation_7day';
export const EVALUATION_HOURS = 168;

type EvaluationRow = {
  planCode?: string | null;
  status?: string | null;
  periodStartsAt?: Date | string | null;
  periodEndsAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
};

const instant = (value: unknown) => {
  const t = value instanceof Date ? value.getTime() :
    typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : NaN;
};

/** Time, not a delayed scheduled job, is authoritative for expiry. */
export function effectiveEvaluationStatus(row: EvaluationRow, now = Date.now()) {
  if (row.planCode !== EVALUATION_PLAN_CODE) return row.status ?? null;
  const started = instant(row.periodStartsAt);
  const ends = instant(row.periodEndsAt);
  const trialEnds = instant(row.trialEndsAt);
  return row.status === 'trialing' && Number.isFinite(started) &&
    ends === trialEnds && ends - started === EVALUATION_HOURS * 3_600_000 &&
    now >= started && now < ends ? 'trialing' : 'expired';
}

/** Expired tenants can review their subscription but not their project data.
 * Exact method/path allowlist; no mutation, wildcard or suffix matching.
 */
export function isEvaluationRecoveryRead(method: string, path: string) {
  if (method.toUpperCase() !== 'GET') return false;
  const clean = path.replace(/\/+$/, '') || '/';
  return new Set([
    '/api/v1/subscription/current',
    '/api/v1/subscription/plans',
    '/api/v1/subscription/history',
    '/api/v1/subscription/events',
    '/api/v1/subscription/billing/invoices',
    '/api/v1/platform/enabled',
  ]).has(clean);
}
