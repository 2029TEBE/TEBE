/**
 * P0: unsigned HTTP callbacks must NEVER invoke this function.
 *
 * Internal CI-only transactional Paddle settlement writer. Not registered in
 * NestJS, not reachable from any public URL and never activates an entitlement.
 * A future webhook adapter must obtain tenant identity from a privileged,
 * server-owned transaction binding AFTER verifying the raw Paddle-Signature.
 * Never trust callback custom_data as the authority for selecting a tenant.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { withTenantSerializable } from '@pmo/db';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ids = {
  event: /^evt_[a-z0-9]{26}$/,
  transaction: /^txn_[a-z0-9]{26}$/,
  price: /^pri_[a-z0-9]{26}$/,
  subscription: /^sub_[a-z0-9]{26}$/,
};
type Input = {
  /** Tenant ID from a trusted database binding, NEVER a request parameter. */
  tenantId: string;
  rawBody: Buffer;
  paddleSignature: string;
  endpointSecret: string;
  nowSeconds?: number;
};
type LedgerResult = {
  recorded: boolean;
  duplicate: boolean;
  settlementId?: string;
  invoiceMarkedPaid: false;
  entitlementGranted: false;
};
const rows = (result: unknown) => result as Array<Record<string, any>>;
const fail = (why: string): never => { throw new Error('Paddle settlement refused: ' + why); };

/** A second, independent CI kill switch cannot be enabled in staging/production. */
export function ensureDisposableWriter(env: NodeJS.ProcessEnv) {
  if (env.CI !== 'true' || env.GITHUB_ACTIONS !== 'true' ||
      env.NODE_ENV !== 'test' || env.DEPLOYMENT_ENV === 'production' ||
      env.DEPLOYMENT_ENV === 'staging' ||
      env.PADDLE_LEDGER_WRITE_MODE !== 'ci_disposable_only' ||
      env.PHASE15_ACCEPT_DISPOSABLE_DB !== 'YES_RESEED_DISPOSABLE_TEST_DATABASE' ||
      env.PADDLE_ENABLED === 'true')
    fail('writer_disabled');
  let url: URL;
  try { url = new URL(env.DATABASE_URL || ''); } catch { return fail('invalid_database_url'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost','127.0.0.1'].includes(url.hostname) ||
      url.port !== '5433' || url.pathname !== '/pmo' ||
      url.username !== 'pmo_app' || url.search || url.hash)
    fail('not_disposable_postgres');
}

/** Match Paddle's ts:RAW-BODY signature; never hash parsed/reformatted JSON. */
export function verifyRawPaddleSignature(
  raw: Buffer, header: string, secret: string, nowSeconds: number,
): boolean {
  if (!Buffer.isBuffer(raw) || !raw.length || raw.length > 65536 ||
      typeof header !== 'string' || header.length > 1024 ||
      typeof secret !== 'string' || Buffer.byteLength(secret) < 24 ||
      !Number.isSafeInteger(nowSeconds)) return false;
  const fields=header.split(';').map(v=>v.trim());
  const timestamps=fields.filter(v=>v.startsWith('ts='));
  const macs=fields.filter(v=>v.startsWith('h1='));
  if (timestamps.length !== 1 || macs.length < 1 || macs.length > 3 ||
      fields.length !== 1 + macs.length) return false;
  const stamp=timestamps[0].slice(3);
  if (!/^[1-9][0-9]{9,11}$/.test(stamp) ||
      Math.abs(nowSeconds-Number(stamp))>5) return false;
  const expected=createHmac('sha256',secret).update(stamp).update(':').update(raw).digest();
  return macs.some(x=>{
    const hex=x.slice(3);
    return /^[a-fA-F0-9]{64}$/.test(hex) &&
      timingSafeEqual(expected,Buffer.from(hex,'hex'));
  });
}

function parseCompleted(raw: Buffer) {
  let event: any;
  try { event=JSON.parse(raw.toString('utf8')); } catch { return fail('invalid_json'); }
  if (!event || Array.isArray(event) || typeof event !== 'object' ||
      event.event_type !== 'transaction.completed' ||
      !ids.event.test(event.event_id ?? '') ||
      !event.data || typeof event.data !== 'object' || Array.isArray(event.data) ||
      event.data.status !== 'completed' ||
      event.data.collection_mode !== 'automatic' ||
      !ids.transaction.test(event.data.id ?? '') ||
      !ids.subscription.test(event.data.subscription_id ?? ''))
    fail('not_a_completed_subscription_transaction');
  const items=event.data.details?.line_items;
  if (!Array.isArray(items) || items.length !== 1 ||
      !ids.price.test(items[0]?.price_id ?? '') ||
      items[0]?.quantity !== 1 ||
      typeof event.data.details?.totals?.grand_total !== 'string' ||
      !/^[1-9][0-9]*$/.test(event.data.details.totals.grand_total) ||
      !/^[A-Z]{3}$/.test(event.data.currency_code ?? '') ||
      !uuid.test(event.data.custom_data?.epmo_intent_id ?? ''))
    fail('invalid_provider_totals_or_intent');
  return event;
}

export async function recordVerifiedPaddleSandboxSettlement(input: Input): Promise<LedgerResult> {
  ensureDisposableWriter(process.env);
  if (!uuid.test(input.tenantId)) fail('invalid_trusted_tenant');
  const seconds=input.nowSeconds ?? Math.floor(Date.now()/1000);
  if (!verifyRawPaddleSignature(input.rawBody,input.paddleSignature,input.endpointSecret,seconds))
    fail('invalid_paddle_signature');
  const event=parseCompleted(input.rawBody);
  const digest=createHash('sha256').update(input.rawBody).digest('hex');
  const tenant=input.tenantId;
  const transaction=event.data.id as string;
  const eventId=event.event_id as string;
  const price=event.data.details.line_items[0].price_id as string;
  const total=Number(event.data.details.totals.grand_total);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 1_000_000_000)
    fail('invalid_amount');

  return withTenantSerializable(tenant, async tx => {
    // Shared tenant lock with other billing paths; the immutable intent is read
    // under SERIALIZABLE, while only mutable invoice/subscription rows are row-locked.
    // FOR UPDATE OF c would incorrectly require UPDATE privilege on an append-only table.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1212,hashtext(${tenant}))`);
    const intent=rows(await tx.execute(sql`
      SELECT c.id AS "intentId",c.tenant_id AS "tenantId",
             c.invoice_id AS "invoiceId", c.subscription_id AS "subscriptionId",
             c.plan_id AS "planId",c.environment,c.expires_at AS "expiresAt",
             c.attempt_id AS "attemptId",
             a.invoice_id AS "attemptInvoiceId",
             a.subscription_id AS "attemptSubscriptionId",
             a.plan_id AS "attemptPlanId",
             a.paddle_price_id AS "attemptPriceId",
             a.environment AS "attemptEnvironment",
             a.amount_minor AS "attemptAmountMinor",
             a.currency AS "attemptCurrency",
             c.paddle_price_id AS "priceId",b.amount_minor AS "amountMinor",
             b.currency,b.status AS "invoiceStatus",
             b.subscription_id AS "invoiceSubscriptionId",
             s.plan_id AS "subscriptionPlanId",s.status AS "subscriptionStatus",
             s.cancel_at_period_end AS "cancelAtPeriodEnd"
      FROM billing_paddle_checkout_intents c
      LEFT JOIN billing_paddle_checkout_attempts a ON a.tenant_id=c.tenant_id AND a.id=c.attempt_id
      JOIN billing_invoices b ON b.tenant_id=c.tenant_id AND b.id=c.invoice_id
      JOIN tenant_subscriptions s ON s.tenant_id=c.tenant_id AND s.id=c.subscription_id
      WHERE c.tenant_id=${tenant} AND c.paddle_transaction_id=${transaction}
      FOR UPDATE OF b,s`))[0];
    if (!intent || !intent.invoiceId || intent.environment !== 'sandbox' ||
        intent.intentId !== event.data.custom_data.epmo_intent_id ||
        intent.priceId !== price || intent.planId !== intent.subscriptionPlanId ||
        intent.invoiceSubscriptionId !== intent.subscriptionId ||
        intent.amountMinor !== total || intent.currency !== event.data.currency_code ||
        !['active','trialing','past_due'].includes(intent.subscriptionStatus) ||
        intent.cancelAtPeriodEnd)
      fail('untrusted_invoice_intent_or_provider_totals');
    // ALL sandbox settlements require the committed pre-POST attempt, even
    // if the legacy checkout-intent row has a NULL attempt_id. A valid HMAC
    // alone must never bypass a missing reservation or tenant binding.
    if (!uuid.test(intent.attemptId ?? '') ||
        intent.attemptInvoiceId !== intent.invoiceId ||
        intent.attemptSubscriptionId !== intent.subscriptionId ||
        intent.attemptPlanId !== intent.planId ||
        intent.attemptPriceId !== intent.priceId ||
        intent.attemptEnvironment !== intent.environment ||
        intent.attemptAmountMinor !== intent.amountMinor ||
        intent.attemptCurrency !== intent.currency ||
        event.data.custom_data.epmo_attempt_id !== intent.attemptId ||
        event.data.custom_data.epmo_invoice_id !== intent.invoiceId ||
        event.data.custom_data.epmo_tenant_id !== tenant)
      fail('untrusted_precreate_attempt_or_webhook_binding');
    if (event.data.custom_data.tenantId &&
        event.data.custom_data.tenantId !== tenant) fail('provider_tenant_mismatch');

    const existing=rows(await tx.execute(sql`
      SELECT r.id, r.payload_sha256 AS "payloadHash",r.checkout_intent_id AS "intentId",
             s.id AS "settlementId",s.paddle_transaction_id AS "transactionId"
      FROM billing_paddle_webhook_receipts r
      LEFT JOIN billing_paddle_settlements s ON s.receipt_id=r.id AND s.tenant_id=r.tenant_id
      WHERE r.tenant_id=${tenant} AND r.paddle_event_id=${eventId}`))[0];
    if (existing) {
      if (existing.payloadHash!==digest || existing.intentId!==intent.intentId ||
          !existing.settlementId || existing.transactionId!==transaction)
        fail('replayed_or_incomplete_receipt');
      return {recorded:false,duplicate:true,settlementId:existing.settlementId,
        invoiceMarkedPaid:false,entitlementGranted:false};
    }
    // Expiry only blocks NEW writes; exact persisted replays above stay idempotent.
    if (intent.invoiceStatus !== 'open' ||
        new Date(intent.expiresAt).getTime() < seconds*1000)
      fail('invoice_not_open_or_intent_expired');
    const already=rows(await tx.execute(sql`
      SELECT id FROM billing_paddle_settlements WHERE tenant_id=${tenant}
        AND (invoice_id=${intent.invoiceId} OR paddle_transaction_id=${transaction})
      LIMIT 1`));
    if (already.length) fail('invoice_or_transaction_already_settled');

    // A failure in EITHER statement rolls back both inserts atomically.
    const receipt=rows(await tx.execute(sql`
      INSERT INTO billing_paddle_webhook_receipts
      (tenant_id,checkout_intent_id,paddle_event_id,event_type,payload_sha256)
      VALUES(${tenant},${intent.intentId},${eventId},'transaction.completed',${digest})
      RETURNING id`))[0];
    if (!receipt?.id) fail('receipt_not_persisted');
    const settlement=rows(await tx.execute(sql`
      INSERT INTO billing_paddle_settlements
      (tenant_id,subscription_id,invoice_id,checkout_intent_id,receipt_id,
       paddle_transaction_id,amount_minor,currency)
      VALUES(${tenant},${intent.subscriptionId},${intent.invoiceId},
        ${intent.intentId},${receipt.id},${transaction},${total},
        ${event.data.currency_code})
      RETURNING id`))[0];
    if (!settlement?.id) fail('settlement_not_persisted');
    return {recorded:true,duplicate:false,settlementId:settlement.id,
      invoiceMarkedPaid:false,entitlementGranted:false};
  });
}
