/**
 * THE EPMO Paddle sandbox account read-only verification.
 *
 * No account creation, credential mutation, billing, notification subscription,
 * customer lookup, or payment request. Deliberately never print an API key,
 * notification secret, account identity, prices, or full provider response.
 *
 * Explicit operator opt-in: PADDLE_SANDBOX_PREFLIGHT=READ_ONLY.
 * This file is not imported by application, checkout, or deployment code.
 */
const API = 'https://sandbox-api.paddle.com';
const requiredEvents = ['transaction.completed','adjustment.created','adjustment.updated'];
const keyPattern = /^pdl_sdbx_apikey_[A-Za-z0-9_-]{20,}$/;
const pricePattern = /^pri_[a-z0-9]{26}$/;
const sellerPattern = /^slr_[a-z0-9]{26}$/;
const tokenPattern = /^test_[A-Za-z0-9_-]{12,}$/;

const report = (reason, patch = {}) => ({
  status:'NOT_VERIFIED',
  reason,
  accountVerified:false,
  sandboxApiKeyVerified:false,
  sandboxPriceCatalogVerified:false,
  notificationDestinationVerified:false,
  webhookSecretMatched:false,
  clientTokenFormatVerified:false,
  sandboxSetupComplete:false,
  realPaymentsEnabled:false,
  ...patch,
});

function allowedWebhookUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' &&
      !url.username && !url.password && !url.search && !url.hash &&
      !['localhost','127.0.0.1','app.theepmo.com','theepmo.com','www.theepmo.com'].includes(url.hostname) &&
      !/^(?:127|10|192\.168)\./.test(url.hostname) &&
      url.pathname.endsWith('/api/v1/billing/paddle-webhook');
  } catch { return false; }
}

async function readJson(fetchImpl, path, key) {
  const response = await fetchImpl(API + path, {
    method:'GET',
    redirect:'error',
    cache:'no-store',
    headers:{Authorization:'Bearer ' + key,Accept:'application/json'},
    signal:AbortSignal.timeout(8000),
  });
  if (!response?.ok || response.status !== 200)
    throw new Error('sandbox_read_failed');
  const body = await response.json();
  if (!body || typeof body !== 'object' || !body.data)
    throw new Error('invalid_sandbox_response');
  return body.data;
}

/** All server requests are GETs to a fixed Paddle sandbox origin. */
export async function verifyPaddleSandboxAccount({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (env.PADDLE_SANDBOX_PREFLIGHT !== 'READ_ONLY')
    return report('explicit_read_only_opt_in_required');
  if (env.BILLING_PROVIDER !== 'paddle' ||
      env.PADDLE_ENV !== 'sandbox' ||
      env.PADDLE_ENABLED !== 'false' ||
      env.STRIPE_ENABLED === 'true')
    return report('payment_environment_must_remain_disabled');
  const key=env.PADDLE_SANDBOX_API_KEY;
  if (!keyPattern.test(key || ''))
    return report('sandbox_api_key_unavailable_or_invalid_format');
  if (typeof fetchImpl !== 'function')
    return report('read_only_transport_unavailable');

  // The account ID is an optional independent check, never a claim about
  // email verification or account approval.
  const expectedSeller=env.PADDLE_SANDBOX_ACCOUNT_ID || '';
  if (!sellerPattern.test(expectedSeller))
    return report('explicit_expected_account_identifier_required');

  let root;
  try { root=await readJson(fetchImpl,'/',key); }
  catch { return report('sandbox_api_identity_not_verified'); }
  if (root.api?.environment !== 'sandbox' ||
      root.caller?.auth_type !== 'api_key' ||
      !sellerPattern.test(root.caller?.account?.id || '') ||
      (expectedSeller && root.caller.account.id !== expectedSeller))
    return report('sandbox_account_identity_mismatch');

  const permissions = new Set(root.caller.permissions || []);
  const clientTokenFormatVerified = tokenPattern.test(env.PADDLE_SANDBOX_CLIENT_TOKEN || '');
  const expectedPrices=(env.PADDLE_SANDBOX_PRICE_IDS || '').split(',')
    .map(x=>x.trim()).filter(Boolean);
  const expectedUrl=env.PADDLE_SANDBOX_WEBHOOK_URL || '';
  let sandboxPriceCatalogVerified=false,notificationDestinationVerified=false,webhookSecretMatched=false;

  if (expectedPrices.length && expectedPrices.length <= 20 &&
      new Set(expectedPrices).size === expectedPrices.length &&
      expectedPrices.every(x=>pricePattern.test(x)) &&
      permissions.has('price.read')) {
    try {
      const data=await readJson(fetchImpl,'/prices?per_page=200',key);
      if (Array.isArray(data)) {
        const active=new Set(data.filter(x=>x.status==='active' && x.billing_cycle)
          .map(x=>x.id));
        sandboxPriceCatalogVerified=expectedPrices.every(x=>active.has(x));
      }
    } catch { /* no unverified catalog claim */ }
  }

  if (allowedWebhookUrl(expectedUrl) && permissions.has('notification_setting.read')) {
    try {
      const data=await readJson(fetchImpl,'/notification-settings?per_page=200',key);
      const match=Array.isArray(data) ? data.find(n =>
        n?.type==='url' && n?.active===true && n.destination===expectedUrl &&
        ['all','platform'].includes(n.traffic_source) &&
        requiredEvents.every(e => n.subscribed_events?.some(x=>x.name===e))) : null;
      notificationDestinationVerified=!!match;
      // Secret is compared only in memory, never logged or echoed.
      const secret=env.PADDLE_SANDBOX_WEBHOOK_SECRET || '';
      const provided=match?.endpoint_secret_key || '';
      if (provided && secret && provided.length === secret.length) {
        const { timingSafeEqual } = await import('node:crypto');
        webhookSecretMatched=timingSafeEqual(Buffer.from(provided),Buffer.from(secret));
      }
    } catch { /* no unverified notification claim */ }
  }

  const complete=sandboxPriceCatalogVerified && notificationDestinationVerified &&
      webhookSecretMatched && clientTokenFormatVerified;
  return report(complete ? 'sandbox_resources_verified' : 'sandbox_account_verified_resources_pending',{
    status:complete?'ACCOUNT_READY':'ACCOUNT_VERIFIED',
    accountVerified:true,
    sandboxApiKeyVerified:true,
    sandboxPriceCatalogVerified,
    notificationDestinationVerified,
    webhookSecretMatched,
    clientTokenFormatVerified,
    sandboxSetupComplete:complete,
  });
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const result=await verifyPaddleSandboxAccount();
  // Account names, credentials, provider IDs and secret values are never emitted.
  console.log(JSON.stringify(result,null,2));
  if (!result.sandboxSetupComplete) process.exitCode=2;
}
