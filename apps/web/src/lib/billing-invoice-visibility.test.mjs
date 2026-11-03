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

test('Paddle billing displays only server-owned records, never checkout actions',()=>{
 const page=readFileSync(new URL('../app/(app)/billing/page.tsx',import.meta.url),'utf8');
 const boundary=readFileSync(new URL('../components/Page.tsx',import.meta.url),'utf8');
 assert.match(page,/!session\.authenticated/);
 assert.match(page,/!session\.capabilities\.includes\('pmoa_admin'\)/);
 assert.match(page,/api\.billingInvoices/);
 assert.match(page,/Paddle is our billing provider/);
 assert.doesNotMatch(page,/<form|checkout\.stripe|paymentVerified:\s*true/);
 assert.match(boundary,/role="alert"/);
});
