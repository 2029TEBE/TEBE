import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./stripe.service.ts', import.meta.url)), 'utf8');
const guard = readFileSync(fileURLToPath(new URL('./stripe-recurring-charge-guard.ts', import.meta.url)), 'utf8');
const settlement = source.slice(source.indexOf('private async settleRecurringInvoice('));
const replay = settlement.slice(settlement.indexOf('if (prior) {'), settlement.indexOf('if (receipt) throw new ConflictException'));
const initial = settlement.slice(settlement.indexOf('if (receipt) throw new ConflictException'));

test('recurring settlement must verify a fresh provider Charge for replay and first settlement', () => {
  assert.match(settlement, /getStripe\(['"]charges\/['"]\s*\+\s*recurringPaidChargeId\(intent\)\)/);
  assert.match(replay, /assertUnreversedRecurringCharge\(intent, charge, replayBinding, replay, false\)/);
  assert.match(initial, /assertUnreversedRecurringCharge\(intent, charge, binding, verified, false\)/);
});

test('recurring replay charge failure must fail closed before duplicate acknowledgement', () => {
  const verify = replay.indexOf('assertUnreversedRecurringCharge(');
  const fail = replay.indexOf('Recurring Stripe replay Charge was reversed or disputed');
  const duplicate = replay.indexOf('duplicate: true');
  assert.ok(verify >= 0 && fail > verify && duplicate > fail);
});

test('charge guard rejects partial refunds, disputes, wrong tenant and live mode', () => {
  for (const predicate of [
    'liveMode', 'verified.tenantId !== binding.tenantId',
    'verified.subscriptionId !== binding.subscriptionId',
    'verified.stripeSubscriptionId !== binding.stripeSubscriptionId',
    'charge.amount_refunded !== 0', 'charge.refunded !== false',
    'charge.disputed !== false', 'charge.livemode !== false',
    'charge.amount_captured !== verified.amountMinor',
    'ref(charge.payment_intent) !== verified.paymentIntentId',
  ]) assert.ok(guard.includes(predicate), 'Missing guard: ' + predicate);
});

test('replay remains TEST-only and tenant transaction scoped', () => {
  assert.match(settlement, /if \(config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(settlement, /withTenant\(tenantId, async tx =>/);
  assert.match(settlement, /pg_advisory_xact_lock\(1212, hashtext/);
});
