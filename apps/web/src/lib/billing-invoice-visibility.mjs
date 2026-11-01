/**
 * Read-only customer billing guard. An unrecognised invoice status is never
 * presented as "voided" or "paid", and cannot expose a Checkout action.
 * The API remains the authority for payment, permissions and invoice state.
 */
const safeId = value => typeof value === 'string' &&
  /^[A-Za-z0-9_-]{1,128}$/.test(value);
const safeCurrency = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
const safePeriod = invoice => {
  const start = Date.parse(invoice.periodStartsAt ?? '');
  const end = Date.parse(invoice.periodEndsAt ?? '');
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
};

export function billingInvoicePresentation(invoice) {
  const unavailable = { status: 'unknown', canCheckout: false };
  if (!invoice || typeof invoice !== 'object' || Array.isArray(invoice) ||
      !safeId(invoice.id) || !Number.isSafeInteger(invoice.amountMinor) ||
      invoice.amountMinor < 0 || !safeCurrency(invoice.currency) ||
      !safePeriod(invoice)) return unavailable;
  const status = invoice.status === 'paid' ? 'paid'
    : invoice.status === 'open' ? 'open'
    : invoice.status === 'void' || invoice.status === 'voided' ? 'voided'
    : 'unknown';
  return {
    status,
    // A zero-value or ambiguous invoice is not a payable Checkout target.
    canCheckout: status === 'open' && invoice.amountMinor > 0,
  };
}

export async function loadVerifiedBillingInvoices(load) {
  // Preserve original 401/403/503 failures for the bilingual Loaded boundary.
  const invoices = await load();
  if (!Array.isArray(invoices) || invoices.length > 500) {
    throw new Error('Invalid billing invoice list');
  }
  const seen = new Set();
  for (const invoice of invoices) {
    if (!invoice || typeof invoice !== 'object' || Array.isArray(invoice) ||
        !safeId(invoice.id) || seen.has(invoice.id)) {
      throw new Error('Invalid billing invoice list');
    }
    seen.add(invoice.id);
  }
  return invoices;
}
