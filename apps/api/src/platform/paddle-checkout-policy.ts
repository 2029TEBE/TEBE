/** Server-only Paddle transaction construction and response validation.
 * This module cannot initiate an API call or provision access. Call it only
 * after authenticating a workspace admin and binding a server-owned checkout
 * intent, then persist the transaction before returning a checkout URL.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE = /^pri_[a-z0-9]{26}$/;
const TRANSACTION = /^txn_[a-z0-9]{26}$/;

export type PaddleCheckoutIntent = {
  tenantId: string;
  invoiceId: string;
  priceId: string;
};

export function paddleApiTarget(environment: string, deploymentEnv: string,
  apiKey: string): { baseUrl: string; apiVersion: string } {
  const sandbox = environment === 'sandbox' && deploymentEnv === 'staging' &&
    /^pdl_sdbx_apikey_[A-Za-z0-9_]{20,}$/.test(apiKey);
  const live = environment === 'live' && deploymentEnv === 'production' &&
    /^pdl_live_apikey_[A-Za-z0-9_]{20,}$/.test(apiKey);
  if (!sandbox && !live) throw Error('Paddle API environment and key are not compatible with deployment');
  return { baseUrl: sandbox ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com',
    apiVersion: '1' };
}

function checkoutBase(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search ||
      url.hash || !url.hostname || url.port || !url.pathname.endsWith('/'))
    throw Error('Invalid server-approved Paddle checkout base URL');
  return url;
}

/** Creates a draft transaction with a catalogued recurring price. Price must
 * have been resolved from a trusted server-side plan-to-price map.
 */
export function paddleTransactionRequest(intent: PaddleCheckoutIntent,
  paymentLinkBase: string) {
  if (!UUID.test(intent.tenantId) || !UUID.test(intent.invoiceId) ||
      !PRICE.test(intent.priceId)) throw Error('Invalid server-bound Paddle intent');
  const link = checkoutBase(paymentLinkBase);
  return {
    collection_mode: 'automatic',
    items: [{ price_id: intent.priceId, quantity: 1 }],
    checkout: { url: link.href },
    custom_data: { epmo_tenant_id: intent.tenantId, epmo_invoice_id: intent.invoiceId },
  };
}

/** Validate the provider URL before the browser navigates.
 * This is *not* proof of payment; paid access requires signed subscription
 * webhooks mapped through a separately stored transaction binding.
 */
export function assertPaddleTransactionResponse(payload: unknown,
  intent: PaddleCheckoutIntent, paymentLinkBase: string) {
  const expected = paddleTransactionRequest(intent, paymentLinkBase);
  if (!payload || typeof payload !== 'object') throw Error('Invalid Paddle response');
  const result = (payload as Record<string, unknown>).data;
  if (!result || typeof result !== 'object') throw Error('Paddle transaction missing');
  const tx = result as Record<string, unknown>;
  if (typeof tx.id !== 'string' || !TRANSACTION.test(tx.id) ||
      !['draft', 'ready'].includes(String(tx.status)) ||
      tx.collection_mode !== expected.collection_mode)
    throw Error('Unexpected Paddle transaction identity or state');
  const meta = tx.custom_data;
  if (!meta || typeof meta !== 'object' ||
      (meta as Record<string, unknown>).epmo_tenant_id !== intent.tenantId ||
      (meta as Record<string, unknown>).epmo_invoice_id !== intent.invoiceId)
    throw Error('Paddle transaction metadata does not match intent');
  if (!Array.isArray(tx.items) || tx.items.length !== 1 ||
      !tx.items[0] || typeof tx.items[0] !== 'object' ||
      (!(tx.items[0] as Record<string, unknown>).price ||
        typeof (tx.items[0] as Record<string, unknown>).price !== 'object' ||
        ((tx.items[0] as Record<string, unknown>).price as Record<string, unknown>).id !== intent.priceId) ||
      (tx.items[0] as Record<string, unknown>).quantity !== 1)
    throw Error('Paddle response item does not match approved price');
  const checkout = tx.checkout;
  if (!checkout || typeof checkout !== 'object' ||
      typeof (checkout as Record<string, unknown>).url !== 'string')
    throw Error('Paddle returned no checkout URL');
  const url = new URL((checkout as {url: string}).url);
  const base = checkoutBase(paymentLinkBase);
  if (url.protocol !== 'https:' || url.origin !== base.origin ||
      url.pathname !== base.pathname || url.username || url.password || url.hash ||
      url.searchParams.get('_ptxn') !== tx.id ||
      [...url.searchParams.keys()].some(k => k !== '_ptxn'))
    throw Error('Untrusted Paddle checkout URL');
  return { transactionId: tx.id, url: url.href, paymentVerified: false };
}
