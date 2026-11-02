/** C55: fail-closed Stripe recurring TEST operator readiness and optional
 * read-only provider Price check. Never creates a checkout, charges, sends
 * webhooks, mutates tenants, stores secrets or claims provider acceptance.
 * Usage: node scripts/stripe-recurring-provider-preflight.mjs [--provider-readonly]
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PRICE = /^price_[A-Za-z0-9]+$/;
const TEST_KEY = /^sk_test_[A-Za-z0-9]{12,}$/;
const WHSEC = /^whsec_[A-Za-z0-9]{16,}$/;
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
const WEB = 'https://staging.theepmo.com';
const HOOK = 'https://api-staging.theepmo.com/api/v1/billing/stripe-webhook';

function configuredPrices(raw) {
  try {
    const value = JSON.parse(raw || '');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entries = Object.entries(value);
    if (!entries.length || entries.length > 20 ||
        entries.some(([code, id]) => !/^[a-zA-Z0-9_-]{1,64}$/.test(code) || !PRICE.test(id))) return null;
    if (new Set(entries.map(([, id]) => id)).size !== entries.length) return null;
    return entries;
  } catch { return null; }
}

export function checkRecurringProviderReadiness(env) {
  const prices = configuredPrices(env.STRIPE_RECURRING_PRICE_IDS);
  const checks = [
    ['Explicitly authorized isolated TEST operator run', env.EPMO_STRIPE_TEST_AUTHORIZATION === 'YES_AUTHORIZED_TEST_ONLY'],
    ['Staging-only deployment', env.DEPLOYMENT_ENV === 'staging' && env.STRIPE_ENABLED === 'true'],
    ['Recurring TEST operator flags enabled', env.STRIPE_TEST_OPERATOR_ENABLED === 'true' && env.STRIPE_RECURRING_CHECKOUT_ENABLED === 'true'],
    ['Restricted TEST key (never LIVE)', TEST_KEY.test(env.STRIPE_SECRET_KEY || '')],
    ['Stripe TEST webhook signing secret', WHSEC.test(env.STRIPE_WEBHOOK_SECRET || '')],
    ['Independent operator credential', TOKEN.test(env.STRIPE_TEST_OPERATOR_SECRET || '')],
    ['Exact HTTPS web origin', env.WEB_ORIGIN === WEB],
    ['Exact HTTPS API webhook path', env.STRIPE_WEBHOOK_PUBLIC_URL === HOOK],
    ['Server-owned recurring TEST Price map', !!prices],
    ['Two distinct disposable tenant IDs', UUID.test(env.EPMO_STRIPE_TEST_TENANT_A || '') && UUID.test(env.EPMO_STRIPE_TEST_TENANT_B || '') && env.EPMO_STRIPE_TEST_TENANT_A !== env.EPMO_STRIPE_TEST_TENANT_B],
    ['Exact canonical source and deployed SHA inputs', SHA.test(env.EPMO_STRIPE_TEST_EXACT_SHA || '') && env.EPMO_STRIPE_TEST_EXACT_SHA === env.EPMO_STRIPE_TEST_DEPLOYED_SHA],
    ['Named independent reviewer', /^[A-Za-z0-9 ._-]{3,80}$/.test(env.EPMO_STRIPE_TEST_REVIEWER || '')],
    ['Reference webhook disabled', env.BILLING_REFERENCE_WEBHOOK_ENABLED !== 'true'],
    ['Staging TEST key permitted in production build', env.NODE_ENV !== 'production' || env.STRIPE_ALLOW_TEST_MODE_IN_PRODUCTION === 'true'],
  ];
  return { checks: checks.map(([name, passed]) => ({ name, passed })),
    prices: prices?.map(([, id]) => id) || [], ready: checks.every(([, passed]) => passed) };
}

export async function readOnlyStripePriceCheck(env, fetchImpl = fetch) {
  const preflight = checkRecurringProviderReadiness(env);
  if (!preflight.ready) throw new Error('Operator readiness is BLOCKED');
  for (const priceId of preflight.prices) {
    const response = await fetchImpl(`https://api.stripe.com/v1/prices/${priceId}`, {
      method: 'GET', redirect: 'error',
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response || response.status !== 200) throw new Error('TEST Price readback failed');
    const price = await response.json();
    if (price?.id !== priceId || price?.object !== 'price' || price?.livemode !== false ||
        price?.active !== true || price?.type !== 'recurring' ||
        !['month', 'year'].includes(price?.recurring?.interval) ||
        price?.currency !== 'sar' || !Number.isSafeInteger(price?.unit_amount) || price.unit_amount <= 0)
      throw new Error('TEST Price readback rejected: recurring/SAR/active/TEST mismatch');
  }
  return { checkedPrices: preflight.prices.length, providerReadback: 'TEST_READ_ONLY',
    providerReceiptsAccepted: 0, releaseAccepted: false };
}

async function main() {
  if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--provider-readonly'))
    throw new Error('Usage: node scripts/stripe-recurring-provider-preflight.mjs [--provider-readonly]');
  const readiness = checkRecurringProviderReadiness(process.env);
  for (const check of readiness.checks) console.log(`${check.passed ? 'PASS' : 'BLOCKED'} ${check.name}`);
  if (!readiness.ready) {
    console.log('BLOCKED: approved TEST-only staging/operator packet incomplete; no provider request sent.');
    process.exitCode = 2;
    return;
  }
  if (process.argv[2] !== '--provider-readonly') {
    console.log('READY: local configuration only. Deployed SHA must be independently attested. Provider NOT contacted.');
    return;
  }
  const result = await readOnlyStripePriceCheck(process.env);
  console.log(`PASS ${result.checkedPrices} Stripe TEST recurring SAR Price readbacks (GET only).`);
  console.log('NO-GO: this is not a checkout, webhook, entitlement or seven-scenario receipt.');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => { console.error('BLOCKED: TEST operator preflight/provider readback failed (details redacted).'); process.exitCode = 2; });
}
