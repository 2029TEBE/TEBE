import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const billing = read('apps/web/src/app/(app)/billing/page.tsx');
const api = read('apps/web/src/lib/api.ts');
const subscriptionService = read('apps/api/src/platform/subscription.service.ts');
const proxy = read('apps/web/src/app/api/billing/subscription/route.ts');
const checkout = read('apps/web/src/app/api/billing/checkout/route.ts');
const freeEvalForm = /<form action="\/api\/evaluation\/start" method="post">[\s\S]*?<\/form>/g;
const billingWithoutEvaluationForm = billing.replace(freeEvalForm,'');
const controller = read('apps/api/src/platform/subscription.controller.ts');
const doc = read('PHASE13F_COMMERCIAL_EXPERIENCE.md');

test('billing page requires an authenticated workspace administrator', () => {
  assert.match(billing, /!session\.authenticated/);
  assert.match(billing, /!session\.capabilities\.includes\('pmoa_admin'\)/);
});

test('subscription and billing history remain tenant-scoped', () => {
  assert.match(api, /subscriptionCurrent: \(\) => get<.*>\('\/api\/v1\/subscription\/current'\)/);
  assert.match(api, /subscriptionPlans: \(\) => get<.*>\('\/api\/v1\/subscription\/plans'\)/);
  assert.match(subscriptionService, /withTenant\(tenantId/);
});

test('subscription reads preserve plan and billing history', () => {
  for(const field of ['planName','priceMinor','billingInterval']) {
    assert.ok(subscriptionService.includes('"' + field + '"'),field);
  }
  assert.match(subscriptionService,/p\.currency/);
  assert.match(billing,/api\.billingInvoices/);
});

test('browser return URL cannot confirm any payment or activate a license', () => {
  assert.match(billing,/No payment is confirmed by a return link/);
  assert.match(billing,freeEvalForm);
  assert.doesNotMatch(billingWithoutEvaluationForm,/confirmPaymentFromQuery|billing === 'success'|<form/);
  assert.match(checkout,/status: 503/);
  assert.doesNotMatch(checkout,/fetch\(|NextResponse\.redirect\(/);
});

test('billing mutation proxy preserves origin check and fails closed', () => {
  assert.match(proxy,/rejectUnsafeBrowserMutation\(req\)/);
  assert.match(proxy,/status: 503/);
  assert.match(proxy,/Cache-Control.*no-store/);
  assert.doesNotMatch(proxy,/fetch\(|NextResponse\.redirect\(/);
});

test('mutation proxy rejects caller-selected tenant and return destinations', () => {
  assert.doesNotMatch(proxy,/tenantId|tenant_id|redirectUrl|returnUrl/);
  assert.doesNotMatch(proxy,/\/api\/v1\/subscription\/cancel-at-period-end|\/api\/v1\/subscription\/resume/);
});

test('plan and historical invoice details are read-only', () => {
  assert.match(billing,/Paddle/);
  assert.match(billing,/historical invoices/);
  assert.doesNotMatch(billingWithoutEvaluationForm,/<form|activatePlan\(|Pay securely with Stripe/);
});

test('subscription changes cannot be applied locally before Paddle verification', () => {
  assert.match(controller,/ServiceUnavailableException/);
  assert.doesNotMatch(controller,/setCancellation\(/);
  assert.match(billing,/subscription changes are temporarily unavailable/);
});

test('billing help and the read-only notice remain bilingual', () => {
  assert.match(billing,/الاشتراك والفوترة/);
  assert.match(billing,/Paddle هو مزود الفوترة/);
  assert.match(billing,/تغيير الاشتراكات غير متاحين/);
});

test('historic Phase 13F release limitations remain documented', () => {
  assert.match(doc,/not production verified/i);
  assert.match(doc,/PostgreSQL/);
});

const onboarding = read('apps/web/src/app/(app)/getting-started/page.tsx');
test('getting started retains admin-only trial expiry guidance', () => {
  assert.match(onboarding,/session\.capabilities\.includes\('pmoa_admin'\)/);
  assert.match(onboarding,/licenseStatus === 'trialing'/);
  assert.match(onboarding,/licenseStatus === 'expired'/);
  assert.match(onboarding,/href="\/billing"/);
});

test('bilingual customer billing guides reject unsupported payment claims', () => {
  const english = read('docs/customer/billing-guide.en.md');
  const arabic = read('docs/customer/billing-guide.ar.md');
  assert.match(english,/Paddle/);
  assert.match(english,/never proves successful payment/);
  assert.match(english,/not yet available/);
  assert.match(arabic,/Paddle/);
  assert.match(arabic,/لا تؤكد صفحة العودة/);
  assert.match(arabic,/لا يمكن للتطبيق إنشاء دفعة جديدة/);
});
