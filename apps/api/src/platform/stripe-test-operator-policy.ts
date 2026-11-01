/** C53: opt-in staging operator gate for TEST recurring checkout.
 * Session authentication and pmoa_admin are enforced separately.
 * Never log or return the operator credential or its configured secret.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
const TEST_KEY = /^sk_test_[A-Za-z0-9]{12,}$/;
const WEBHOOK_SECRET = /^whsec_[A-Za-z0-9]{16,}$/;

function approvedStagingWebhook(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'staging.theepmo.com' &&
      url.port === '' && !url.username && !url.password && !url.search && !url.hash &&
      url.pathname === '/api/v1/billing/stripe-webhook' &&
      url.origin + url.pathname === raw;
  } catch { return false; }
}

export function stripeTestOperatorAllowed(env: Record<string, string | undefined>, credential: unknown): boolean {
  if (env.DEPLOYMENT_ENV !== 'staging' ||
      env.STRIPE_TEST_OPERATOR_ENABLED !== 'true' ||
      env.STRIPE_RECURRING_CHECKOUT_ENABLED !== 'true' ||
      env.STRIPE_ENABLED !== 'true' ||
      !TEST_KEY.test(env.STRIPE_SECRET_KEY || '') ||
      !WEBHOOK_SECRET.test(env.STRIPE_WEBHOOK_SECRET || '') ||
      !approvedStagingWebhook(env.STRIPE_WEBHOOK_PUBLIC_URL) ||
      !TOKEN.test(env.STRIPE_TEST_OPERATOR_SECRET || '') ||
      typeof credential !== 'string' || !TOKEN.test(credential)) return false;
  const expected = createHash('sha256').update(env.STRIPE_TEST_OPERATOR_SECRET!).digest();
  const supplied = createHash('sha256').update(credential).digest();
  return timingSafeEqual(expected, supplied);
}
