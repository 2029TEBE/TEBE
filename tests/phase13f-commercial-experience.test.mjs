import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const billing=read('apps/web/src/app/(app)/billing/page.tsx');
const api=read('apps/web/src/lib/api.ts');
const service=read('apps/api/src/platform/subscription.service.ts');
const checkout=read('apps/web/src/app/api/billing/checkout/route.ts');
const changes=read('apps/web/src/app/api/billing/subscription/route.ts');
test('billing page requires authenticated tenant administrator',()=>{
 assert.match(billing,/!session\.authenticated/);
 assert.match(billing,/!session\.capabilities\.includes\('pmoa_admin'\)/);
});
test('subscription data is loaded through tenant-bound API',()=>{
 assert.match(api,/subscriptionCurrent:/);
 assert.match(api,/billingInvoices:/);
 assert.match(service,/withTenant\(tenantId/);
});
test('billing page shows plan, period and invoice history',()=>{
 for(const label of ['planName','priceMinor','periodEndsAt','api.billingInvoices'])
 assert.ok(billing.includes(label),label);
});
test('Paddle is the only customer-facing provider and payments remain disabled',()=>{
 assert.match(billing,/Paddle is our billing provider/);
 assert.match(billing,/Paddle هو مزود الفوترة/);
 assert.doesNotMatch(billing,/<form|paymentVerified:\s*true|activatePlan\(/);
});
test('billing mutation routes enforce CSRF and return non-cached 503',()=>{
 for(const source of [checkout,changes]){
  assert.match(source,/rejectUnsafeBrowserMutation\(req\)/);
  assert.match(source,/status: 503/);
  assert.match(source,/Cache-Control': 'no-store'/);
  assert.doesNotMatch(source,/tenantId|tenant_id|redirectUrl|returnUrl/);
 }
});
test('customer billing guides describe signed payment verification in Arabic and English',()=>{
 const en=read('docs/customer/billing-guide.en.md'),ar=read('docs/customer/billing-guide.ar.md');
 assert.match(en,/Paddle/);
 assert.match(ar,/Paddle/);
 assert.match(en,/not proof.*payment/i);
});
