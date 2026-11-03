import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./stripe.service.ts', import.meta.url)), 'utf8');
const start = source.indexOf('private async settleRecurringInvoice(');
assert.ok(start >= 0, 'Recurring settlement implementation must exist');
const settlement = source.slice(start, source.indexOf('  /** Stripe signs the raw request.', start));
const prior = settlement.slice(settlement.indexOf('const prior = rows('), settlement.indexOf('if (prior) {'));

test('historical recurring replay requires payment and settlement event identity to agree', () => {
  assert.match(prior, /p\.provider_payment_id = e\.details ->> 'paymentIntent'/);
  assert.match(prior, /p\.provider_event_id = e\.details ->> 'eventId'/);
  assert.match(prior, /e\.details ->> 'stripeInvoiceId' = \$\{candidate\.invoiceId\}/);
  assert.match(prior, /e\.tenant_id = \$\{tenantId\}/);
  assert.match(prior, /e\.subscription_id = \$\{binding\.subscriptionId\}/);
});

test('a replay still requires a fresh provider Charge and cannot grant a second period', () => {
  const replay = settlement.slice(settlement.indexOf('if (prior) {'), settlement.indexOf('if (receipt) throw new ConflictException'));
  assert.match(replay, /assertUnreversedRecurringCharge\(intent, charge, replayBinding, replay, false\)/);
  assert.match(replay, /applied: false, duplicate: true/);
  assert.doesNotMatch(replay, /UPDATE tenant_subscriptions/);
});
