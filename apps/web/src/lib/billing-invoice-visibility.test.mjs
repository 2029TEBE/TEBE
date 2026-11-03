import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { billingInvoicePresentation, loadVerifiedBillingInvoices } from './billing-invoice-visibility.mjs';

const invoice = () => ({
  id: '11111111-1111-4111-8111-111111111111',
  status: 'open', amountMinor: 12500, currency: 'SAR',
  periodStartsAt: '2026-10-01T00:00:00Z',
  periodEndsAt: '2026-11-01T00:00:00Z',
});

test('valid synthetic open invoice permits only a server-authorized checkout form', () => {
  assert.deepEqual(billingInvoicePresentation(invoice()), { status: 'open', canCheckout: true });
  assert.deepEqual(billingInvoicePresentation({ ...invoice(), status: 'paid' }), { status: 'paid', canCheckout: false });
  assert.deepEqual(billingInvoicePresentation({ ...invoice(), status: 'voided' }), { status: 'voided', canCheckout: false });
  assert.deepEqual(billingInvoicePresentation({ ...invoice(), status: 'void' }), { status: 'voided', canCheckout: false });
});

test('unknown or inconsistent invoice states cannot masquerade as voided, paid or payable', () => {
  for (const change of [
    { status: 'refunded' }, { status: 'uncollectible' }, { status: null },
    { status: 'PAID' }, { amountMinor: -1 }, { amountMinor: '12500' },
    { amountMinor: Number.MAX_SAFE_INTEGER + 1 }, { currency: 'SAR<script>' },
    { id: '../billing' }, { id: '' }, { periodEndsAt: 'invalid' },
    { periodEndsAt: '2026-09-01T00:00:00Z' },
  ]) {
    assert.deepEqual(billingInvoicePresentation({ ...invoice(), ...change }),
      { status: 'unknown', canCheckout: false });
  }
  assert.equal(billingInvoicePresentation({ ...invoice(), amountMinor: 0 }).canCheckout, false);
  assert.deepEqual(billingInvoicePresentation(null), { status: 'unknown', canCheckout: false });
});

test('malformed, duplicate and oversized invoice collections fail closed', async () => {
  for (const value of [null, {}, '<html>login</html>', [null], [{ ...invoice(), id: '' }],
    [invoice(), invoice()], Array(501).fill(invoice())]) {
    await assert.rejects(loadVerifiedBillingInvoices(async () => value), /Invalid billing invoice list/);
  }
  assert.equal((await loadVerifiedBillingInvoices(async () => [invoice()])).length, 1);
});

test('401 expired session, 403 denied and 503 outage are not disguised as empty invoices', async () => {
  for (const status of [401, 403, 503]) {
    const error = Object.assign(new Error('Synthetic API rejection'), { status });
    await assert.rejects(loadVerifiedBillingInvoices(async () => { throw error; }), e => e === error);
  }
});

test('Arabic 375px and English desktop billing UI uses safe state and authorization guard', () => {
  const page = readFileSync(new URL('../app/(app)/billing/page.tsx', import.meta.url), 'utf8');
  const boundary = readFileSync(new URL('../components/Page.tsx', import.meta.url), 'utf8');
  assert.match(page, /loadVerifiedBillingInvoices\(api\.billingInvoices\)/);
  assert.match(page, /billingInvoicePresentation\(i\)/);
  // Paddle checkout is disabled: a valid open invoice must never render a legacy payment action.
  assert.doesNotMatch(page, /invoiceView\\.canCheckout/);
  assert.doesNotMatch(page, /<form\\b/);
  assert.doesNotMatch(page, /stripe\\.com|checkout\\/sessions|checkoutUrl/i);
  assert.match(page, /Paddle checkout is not implemented/);
  assert.match(page, /api\\.subscriptionCurrent/);
  assert.match(page, /api\\.subscriptionPlans/);
  assert.match(page, /api\\.billingExceptions/);
  assert.match(page, /!session\\.authenticated/);
  assert.match(page, /session\\.capabilities\\.includes\\('pmoa_admin'\\)/);
  assert.match(page, /Status unavailable/);
  assert.match(page, /الحالة غير متاحة/);
  assert.doesNotMatch(page, /i\.status === 'open' && <form/);
  assert.match(boundary, /err\.status === 401/);
  assert.match(boundary, /err\.status === 403/);
  assert.match(boundary, /role="alert"/);
});

test('Paddle migration billing remains informational in both languages and cannot claim redirect success', () => {
  const page = readFileSync(new URL('../app/(app)/billing/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /Online checkout and subscription changes are temporarily disabled/);
  assert.match(page, /الدفع الإلكتروني وتغيير الاشتراكات متوقفان مؤقتًا/);
  assert.match(page, /this URL does not confirm an invoice or payment/);
  assert.match(page, /هذا الرابط لا يؤكد إنشاء فاتورة أو إتمام الدفع/);
  assert.match(page, /this URL does not confirm cancellation or resumption/);
  assert.match(page, /لا يؤكد الإلغاء أو استئناف الاشتراك/);
  assert.match(page, /<Loaded load=\{\(\) => loadVerifiedBillingInvoices\(api\.billingInvoices\)\}/);
});
