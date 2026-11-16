import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const policy=source('./payment-provider-policy.ts');
const stripe=source('./stripe.service.ts');
const controller=source('./billing.controller.ts');
const web=source('../../../web/src/app/api/billing/checkout/route.ts');
const pricing=source('../../../web/src/app/(app)/billing/page.tsx');
const other=source('./paddle-checkout-policy.ts');

test('new charge routing names only Stripe, not another payment provider',()=>{
 assert.match(policy,/PRIMARY_PAYMENT_PROVIDER = 'stripe'/);
 assert.match(policy,/assertStripeForNewCharges/);
 assert.match(stripe,/assertStripeForNewCharges\(process\.env\.BILLING_PAYMENT_PROVIDER\)/);
 assert.match(controller,/@Post\('stripe\/checkout'\)/);
 assert.doesNotMatch(controller,/@Post\('paddle/);
 assert.doesNotMatch(controller,/PaddleBillingService/);
});
test('future purchase capabilities are not falsely represented as automatic recurring billing',()=>{
 assert.match(policy,/first-purchase-self-service/);
 assert.match(policy,/automatic-stripe-billing-subscriptions/);
 assert.match(policy,/paidAccessRequiresVerifiedWebhook: true/);
 assert.match(policy,/providerSwitchDoesNotMoveExistingSubscriptions: true/);
 assert.match(pricing,/Pay securely with Stripe/);
 assert.match(pricing,/renewal invoice/i);
});
test('Stripe server path requires verified invoice payment before access',()=>{
 assert.match(stripe,/STRIPE_ENABLED !== 'true'/);
 assert.match(stripe,/STRIPE_WEBHOOK_SECRET/);
 assert.match(stripe,/verifyStripeSignature\(/);
 assert.match(stripe,/stripeCheckoutIdempotencyKey\(invoiceId, attempts\)/);
 assert.match(stripe,/assertStripeSettlement\(/);
 assert.match(web,/url\.hostname !== 'checkout\.stripe\.com'/);
 assert.match(stripe,/billing=cancel[^a-z]/);
});
test('legacy Paddle pure policies have no payment endpoint or entitlement mutation',()=>{
 assert.doesNotMatch(other,/fetch\(|withTenant\(|UPDATE tenant_subscriptions/);
 assert.doesNotMatch(controller,/paddle|Paddle/);
});
