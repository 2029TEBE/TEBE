import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = path => readFileSync(new URL('./' + path, import.meta.url),'utf8');
const controller = api('paid-deployment.controller.ts');
const stripe = api('stripe.service.ts');
const page = readFileSync(new URL('../../../../web/src/app/(app)/billing/payment-pending/page.tsx', import.meta.url),'utf8');
const refresh = readFileSync(new URL('../../../../web/src/components/VerifiedPaymentRefresh.tsx', import.meta.url),'utf8');
const probe = readFileSync(new URL('../../../../infra/servitro-probe-contract.mjs', import.meta.url),'utf8');

test('Q88: paid access is bounded to authenticated context, uncached and verified records', () => {
 assert.match(controller, /@Header\('Cache-Control', 'private, no-store, max-age=0'\)/);
 const method=controller.slice(controller.indexOf('async paidAccess()'));
 assert.ok(method.indexOf('try {') < method.indexOf('currentContext()'));
 assert.ok(method.indexOf('currentContext()') < method.indexOf('} catch {'));
 assert.match(method, /if \(!tenantId \|\| !userId\) throw/);
 assert.match(method, /JOIN billing_webhook_receipts r/);
 assert.equal((method.match(/throw new ForbiddenException\('Access unavailable'\)/g)||[]).length,1);
});

test('Q88: recurring Stripe replay independently rejects reversed TEST Charges', () => {
 const settlement=stripe.slice(stripe.indexOf('private async settleRecurringInvoice('));
 assert.match(settlement, /getStripe\(\`charges\/\$\{chargeId\}\`\)/);
 assert.match(settlement, /assertUnreversedRecurringCharge\(intent, charge, replayBinding, replay, false\)/);
 assert.match(settlement, /Recurring Stripe replay Charge was reversed or disputed/);
 assert.match(settlement, /assertUnreversedRecurringCharge\(intent, charge, binding, verified, false\)/);
});

test('Q88: browser refresh is information only and stalls when hidden or offline', () => {
 assert.match(page, /api\.subscriptionCurrent\(\)/);
 assert.match(page, /VerifiedPaymentRefresh/);
 assert.match(refresh, /document\.visibilityState === 'visible'/);
 assert.match(refresh, /navigator\.onLine/);
 assert.match(refresh, /maxChecks = 8/);
 assert.match(refresh, /router\.refresh\(\)/);
 assert.doesNotMatch(refresh, /setCookie\(|localStorage|sessionStorage|paymentVerified\s*=/);
});

test('Q88: offline Servitro structural receipts never authorize deployment', () => {
 assert.match(probe,/operationallyVerified:false,deploymentAuthorized:false/);
 assert.match(probe,/independent-readonly-probe/);
 assert.match(probe,/tls\.verified/);
});
