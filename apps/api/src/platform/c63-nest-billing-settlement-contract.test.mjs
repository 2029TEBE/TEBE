import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const controller = read('./billing.controller.ts');
const stripe = read('./stripe.service.ts');

test('authenticated customer checkout is strictly gated and delegates to server-owned pricing', () => {
  assert.match(controller, /@Controller\('api\/v1\/subscription\/billing'\)/);
  assert.match(controller, /@Post\('stripe\/recurring-checkout'\)/);
  assert.match(controller, /STRIPE_RECURRING_CUSTOMER_CHECKOUT_ENABLED !== 'true'/);
  assert.match(controller, /process\.env\.DEPLOYMENT_ENV !== 'staging'/);
  assert.match(controller, /this\.stripe\.prepareRecurringCheckout\(\)/);
  const checkout = stripe.slice(stripe.indexOf('async prepareRecurringCheckout()'), stripe.indexOf('async createCheckout('));
  assert.match(checkout, /requireCapability\('pmoa_admin'\)/);
  assert.match(checkout, /currentContext\(\)/);
  assert.match(checkout, /withTenant\(tenantId/);
  assert.match(checkout, /assertRecurringStripePrice/);
  assert.match(checkout, /paymentVerified: false/);
  assert.doesNotMatch(checkout, /UPDATE tenant_subscriptions\s+SET status = 'active'/);
});

test('Nest webhook uses raw bytes, not request JSON or caller-selected tenant', () => {
  const ingress = controller.slice(controller.indexOf('export class BillingWebhookController'));
  assert.match(ingress, /req\.rawBody/);
  assert.match(ingress, /req\.headers\['stripe-signature'\]/);
  assert.match(ingress, /this\.stripe\.webhook\(req\.rawBody, req\.headers\['stripe-signature'\]\)/);
  assert.doesNotMatch(ingress, /currentContext\(\)|req\.headers\['x-tenant-id'\]/);
  const handler = stripe.slice(stripe.indexOf('async webhook('));
  assert.match(handler, /verifyStripeSignature\(rawBody, header, config\.webhookSecret\)/);
  assert.match(handler, /parsePaidRecurringInvoice/);
  assert.match(handler, /settleRecurringInvoice/);
});

test('signed invoice settlement is bound to persisted tenant subscription and provider records', () => {
  const start = stripe.indexOf('private async settleRecurringInvoice(');
  const end = stripe.indexOf('async webhook(', start);
  assert.ok(start > 0 && end > start);
  const settlement = stripe.slice(start, end);
  for (const fragment of [
    'config.liveMode', 'DEPLOYMENT_ENV', 'invoices/', 'subscriptions/',
    'payment_intents/', 'charges/', 'withTenant(tenantId',
    'pg_advisory_xact_lock', 'billing_stripe_recurring_bindings',
    'FOR UPDATE', 'assertRecurringProviderSettlement',
    'assertRecurringLocalSettlement'
  ]) assert.ok(settlement.includes(fragment), `Missing settlement guard: ${fragment}`);
  assert.match(settlement, /subscription\?\.metadata\?\.tenantId/);
  assert.match(settlement, /record\.stripeSubscriptionId|record\.stripeCustomerId/);
});

test('webhook signature failure precedes every recurring event mutation', () => {
  const handler = stripe.slice(stripe.indexOf('async webhook('));
  const verify = handler.indexOf('verifyStripeSignature(');
  const binding = handler.indexOf('this.bindRecurringCheckout(');
  const settlement = handler.indexOf('this.settleRecurringInvoice(');
  assert.ok(verify >= 0 && binding > verify && settlement > verify);
});

test('subscription redirect alone is not a paid receipt', () => {
  const checkout = stripe.slice(stripe.indexOf('async prepareRecurringCheckout()'), stripe.indexOf('async createCheckout('));
  assert.match(checkout, /billing_stripe_recurring_checkout_sessions/);
  assert.match(checkout, /paymentVerified: false/);
  assert.doesNotMatch(checkout, /billing_payments\s*\(/);
});
