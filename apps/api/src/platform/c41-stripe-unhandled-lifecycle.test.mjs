/**
 * C41: synthetic signed lifecycle regression. No provider calls, money,
 * customer data, or staging acceptance is implied by these tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyStripeSignature } from './stripe-policy.ts';
import { requiresRecurringLifecycleReconciliation } from './stripe-recurring-unhandled-lifecycle.ts';

const invoice = {
  object: 'invoice', id: 'in_C41', livemode: false,
  subscription: 'sub_C41', billing_reason: 'subscription_cycle',
};
const envelope = (type, object) => ({
  id: 'evt_C41', type, livemode: false, data: { object },
});
const signed = event => {
  const raw = Buffer.from(JSON.stringify(event));
  const secret = 'whsec_12345678901234567890123456789012';
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac('sha256', secret)
    .update(String(timestamp)).update('.').update(raw).digest('hex');
  return { raw, header: 't=' + timestamp + ',v1=' + digest, secret };
};

test('C41: signed recurring terminal invoices fail closed instead of being ignored', () => {
  for (const type of ['invoice.voided', 'invoice.marked_uncollectible',
    'invoice.finalization_failed', 'invoice.payment_action_required']) {
    const event = envelope(type, invoice);
    const { raw, header, secret } = signed(event);
    assert.equal(verifyStripeSignature(raw, header, secret), true);
    assert.equal(requiresRecurringLifecycleReconciliation(event), true, type);
    assert.equal(verifyStripeSignature(Buffer.concat([raw, Buffer.from(' ')]),
      header, secret), false);
  }
});

test('C41: parent subscription references and malformed terminal invoices fail closed', () => {
  assert.equal(requiresRecurringLifecycleReconciliation(envelope('invoice.voided', {
    object: 'invoice', parent: { subscription_details: { subscription: 'sub_C41' } },
  })), true);
  assert.equal(requiresRecurringLifecycleReconciliation(envelope(
    'invoice.marked_uncollectible', null)), true);
  assert.equal(requiresRecurringLifecycleReconciliation(envelope(
    'invoice.finalization_failed', { object: 'unexpected' })), true);
});

test('C41: one-time invoices and supported recurring events are not intercepted', () => {
  assert.equal(requiresRecurringLifecycleReconciliation(envelope('invoice.voided', {
    object: 'invoice', billing_reason: 'manual', subscription: null,
  })), false);
  assert.equal(requiresRecurringLifecycleReconciliation(envelope('invoice.paid',
    invoice)), false);
  assert.equal(requiresRecurringLifecycleReconciliation(envelope(
    'customer.subscription.updated', { object: 'subscription', status: 'active' })), false);
  assert.equal(requiresRecurringLifecycleReconciliation(envelope(
    'customer.subscription.updated', { object: 'subscription', status: 'trialing' })), false);
  assert.equal(requiresRecurringLifecycleReconciliation(envelope(
    'customer.subscription.deleted', { object: 'subscription', status: 'canceled' })), false);
});

test('C41: unsupported subscription status updates never silently acknowledge', () => {
  for (const status of ['past_due', 'incomplete', 'incomplete_expired', 'canceled']) {
    assert.equal(requiresRecurringLifecycleReconciliation(envelope(
      'customer.subscription.updated', { object: 'subscription', status })), true, status);
  }
  assert.equal(requiresRecurringLifecycleReconciliation(envelope(
    'customer.subscription.updated', null)), true);
});

test('C41: fail-closed gate precedes generic Stripe event ignore in webhook', () => {
  const source = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('  async webhook('));
  const gate = method.indexOf('requiresRecurringLifecycleReconciliation(signedEnvelope)');
  const exception = method.indexOf('parseStripePaymentException(rawBody');
  const ignored = method.indexOf('if (!event) return { received: true, applied: false, ignored: true }');
  assert.ok(gate > 0 && exception > gate && ignored > exception);
  assert.match(method.slice(gate, exception), /ServiceUnavailableException/);
});
