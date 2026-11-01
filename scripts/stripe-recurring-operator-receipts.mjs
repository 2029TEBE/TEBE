/**
 * C52: offline validation of operator-collected REAL Stripe TEST receipts.
 * This tool NEVER calls Stripe, sends a webhook, creates a payment or changes
 * entitlements. It validates receipt consistency, not provider authenticity.
 * An independent reviewer MUST inspect each linked artifact before acceptance.
 *
 * Usage: node scripts/stripe-recurring-operator-receipts.mjs /private/receipts.json
 * Store operator inputs outside Git; NEVER include keys, cookies, customer data.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const REQUIRED_SCENARIOS = Object.freeze([
  'first_customer_subscription_checkout',
  'webhook_signature_verified',
  'webhook_replay_idempotent',
  'entitlement_activation',
  'failed_payment_access_policy',
  'subscription_cancellation',
  'cross_tenant_billing_isolation',
]);
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const SESSION = /^cs_test_[A-Za-z0-9]+$/;
const SUB = /^sub_[A-Za-z0-9]+$/;
const noSecrets = /sk_(?:test|live)_|rk_(?:test|live)_|whsec_|pmo_session|authorization\s*:|bearer\s+|password|private.key|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i;
function requireSafe(value, reason) { if (!value) throw new Error(reason); }
function recentUtc(stamp, now) {
  requireSafe(typeof stamp === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(stamp), 'Invalid UTC timestamp');
  const time = Date.parse(stamp);
  requireSafe(Number.isFinite(time) && time <= now && now - time <= 72 * 3600 * 1000, 'Receipt timestamp is missing, future-dated or older than 72 hours');
}
function safeArtifact(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Missing HTTPS GitHub Actions evidence URL'); }
  requireSafe(url.protocol === 'https:' && url.hostname === 'github.com' &&
    !url.username && !url.password && !url.search && !url.hash &&
    /^\/faisalwrokksa-hub\/THEEPMOTEST\/actions\/runs\/[1-9]\d*(?:\/artifacts\/[1-9]\d*)?$/.test(url.pathname),
    'Evidence must link to a credential-free GitHub Actions run/artifact');
}
function trueFields(proof, names, scenario) {
  for (const name of names) requireSafe(proof[name] === true, scenario + ': missing ' + name + ' proof');
}
function validateProof(name, proof, tenants) {
  requireSafe(proof && typeof proof === 'object' && !Array.isArray(proof), name + ': proof missing');
  if (name === 'first_customer_subscription_checkout') {
    requireSafe(proof.checkoutMode === 'subscription' && SESSION.test(proof.checkoutSessionId) &&
      SUB.test(proof.stripeSubscriptionId) && proof.providerLivemode === false,
      'Checkout must be provider-confirmed subscription-mode TEST');
    trueFields(proof, ['tenantBound','priceServerOwned','providerReadback'], name);
  } else if (name === 'webhook_signature_verified') {
    trueFields(proof, ['rawBodyUsed','validSignatureAccepted','tamperedSignatureRejected','unsignedRejected','providerEventMatched'], name);
  } else if (name === 'webhook_replay_idempotent') {
    requireSafe(proof.receiptCountBefore === 1 && proof.receiptCountAfter === 1 &&
      proof.ledgerCountBefore === 1 && proof.ledgerCountAfter === 1,
      'Replay must retain one receipt and one ledger settlement');
    trueFields(proof, ['entitlementUnchanged','sameEventDigest'], name);
  } else if (name === 'entitlement_activation') {
    requireSafe(proof.paymentLedgerRows === 1, 'Activation requires exactly one tenant ledger payment');
    trueFields(proof, ['entitlementActive','providerInvoicePaid','tenantBound','noRedirectOnlyGrant'], name);
  } else if (name === 'failed_payment_access_policy') {
    requireSafe(proof.failureStatus === 'past_due', 'Failure must reconcile to past_due');
    trueFields(proof, ['noNewGrant','unexpiredAccessPreserved','expiredAccessDenied','providerFailureMatched'], name);
  } else if (name === 'subscription_cancellation') {
    trueFields(proof, ['providerCanceled','entitlementRevoked','replayNoRegrant','tenantBound'], name);
  } else if (name === 'cross_tenant_billing_isolation') {
    requireSafe(proof.tenantA === tenants.a && proof.tenantB === tenants.b, 'Tenant identities do not match');
    trueFields(proof, ['foreignReadDenied','foreignWriteDenied','crossTenantReplayDenied','restrictedRlsRole'], name);
  }
}
export function validateStripeOperatorReceipts(bundle, now = Date.now()) {
  requireSafe(bundle && typeof bundle === 'object' && !Array.isArray(bundle), 'Receipt bundle must be an object');
  requireSafe(!noSecrets.test(JSON.stringify(bundle)), 'Sensitive credentials, identifiers or personal data forbidden in receipts');
  requireSafe(SHA.test(bundle.candidateSha || ''), 'Exact 40-character candidate SHA required');
  requireSafe(bundle.environment === 'staging' && bundle.stripeMode === 'test' &&
    bundle.providerReceipts === 'real-test-only', 'Only real TEST staging receipt claims are allowed');
  requireSafe(typeof bundle.reviewer === 'string' && /^[A-Za-z0-9 ._-]{3,80}$/.test(bundle.reviewer),
    'Named independent reviewer required');
  requireSafe(bundle.tenants && UUID.test(bundle.tenants.a || '') && UUID.test(bundle.tenants.b || '') &&
    bundle.tenants.a !== bundle.tenants.b, 'Two distinct disposable tenant UUIDs required');
  requireSafe(bundle.scenarios && typeof bundle.scenarios === 'object' &&
    Object.keys(bundle.scenarios).length === REQUIRED_SCENARIOS.length, 'Exactly seven Stripe scenarios required');
  const ids = new Set();
  for (const name of REQUIRED_SCENARIOS) {
    const receipt = bundle.scenarios[name];
    requireSafe(receipt && receipt.status === 'PASS' && receipt.testResult === 'passed' &&
      receipt.commitSha === bundle.candidateSha && receipt.stripeMode === 'test',
      name + ': missing same-SHA TEST passing receipt');
    recentUtc(receipt.executedAtUtc, now);
    safeArtifact(receipt.artifactUrl);
    requireSafe(HASH.test(receipt.eventIdSha256 || ''), name + ': SHA-256 event ID digest required');
    ids.add(receipt.eventIdSha256);
    validateProof(name, receipt.proof, bundle.tenants);
  }
  // Distinct webhook/failure/cancellation events are expected; replay intentionally shares an event.
  const s = bundle.scenarios;
  requireSafe(s.webhook_signature_verified.eventIdSha256 === s.webhook_replay_idempotent.eventIdSha256,
    'Replay must reference the same signed webhook event');
  requireSafe(s.failed_payment_access_policy.eventIdSha256 !== s.subscription_cancellation.eventIdSha256,
    'Failure and cancellation must be distinct provider events');
  return {
    candidateSha: bundle.candidateSha,
    operatorClaimsValidated: REQUIRED_SCENARIOS.length,
    uniqueEventDigests: ids.size,
    providerIndependentlyVerified: false,
    releaseAccepted: false,
    decision: 'NO-GO',
    next: 'Independent reviewer must inspect exact-SHA provider, signature, ledger and staging artifacts',
  };
}
async function main() {
  requireSafe(process.argv.length === 3, 'Usage: node scripts/stripe-recurring-operator-receipts.mjs /private/receipts.json');
  const input = await readFile(resolve(process.argv[2]), 'utf8');
  requireSafe(input.length <= 128 * 1024, 'Receipt bundle too large');
  const summary = validateStripeOperatorReceipts(JSON.parse(input));
  console.log(JSON.stringify(summary, null, 2));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    // Deliberately do not echo operator-supplied file content or HTTP headers.
    console.error('BLOCKED Stripe TEST operator receipt review:', error instanceof Error ? error.message : 'Invalid evidence');
    process.exitCode = 1;
  });
}
