/**
 * E81: Pure, fail-closed predicate for a server-loaded Paddle settlement.
 * This does NOT verify a Paddle webhook signature or grant access by itself.
 * Callers MUST load these records from tenant-restricted PostgreSQL after
 * verifying the raw Paddle-Signature and committing an idempotent receipt.
 * No browser-supplied IDs, prices, redirects, or historical Stripe rows.
 */
export type PaddleSettlementEvidence = Readonly<{
  provider: string;
  tenantId: string;
  subscriptionId: string;
  transactionId: string;
  receiptTransactionId: string;
  receiptSubscriptionId: string;
  receiptEventId: string;
  receiptId: string;
  expectedSubscriptionId: string;
  receiptTenantId: string;
  receiptProvider: string;
  receiptSignatureVerified: boolean;
  receiptCommitted: boolean;
  transactionStatus: string;
  subscriptionStatus: string;
  currency: string;
  amountMinor: number;
  expectedAmountMinor: number;
  expectedCurrency: string;
  periodStart: Date;
  periodEnd: Date;
  revokedAt: Date | null;
}>;

const validId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 200 &&
  /^[a-zA-Z0-9_-]+$/.test(v);

export function hasTenantBoundPaddleSettlement(
  evidence: PaddleSettlementEvidence | null | undefined,
  authenticatedTenantId: string,
  now: Date = new Date(),
): boolean {
  if (!evidence || !validId(authenticatedTenantId) ||
      !Number.isFinite(now.getTime())) return false;
  const e = evidence;
  if (e.provider !== 'paddle' || e.receiptProvider !== 'paddle' ||
      !validId(e.tenantId) || e.tenantId !== authenticatedTenantId ||
      e.receiptTenantId !== authenticatedTenantId ||
      !validId(e.subscriptionId) ||
      !validId(e.expectedSubscriptionId) ||
      e.subscriptionId !== e.expectedSubscriptionId ||
      !validId(e.receiptSubscriptionId) ||
      e.receiptSubscriptionId !== e.subscriptionId ||
      !validId(e.receiptEventId) || !validId(e.receiptId) ||
      !validId(e.transactionId) ||
      e.transactionId !== e.receiptTransactionId ||
      !e.receiptSignatureVerified || !e.receiptCommitted ||
      e.transactionStatus !== 'completed' ||
      e.subscriptionStatus !== 'active' ||
      e.revokedAt !== null ||
      !Number.isSafeInteger(e.amountMinor) || e.amountMinor < 0 ||
      !Number.isSafeInteger(e.expectedAmountMinor) ||
      e.expectedAmountMinor <= 0 || e.amountMinor !== e.expectedAmountMinor ||
      !/^[A-Z]{3}$/.test(e.currency) ||
      e.currency !== e.expectedCurrency ||
      !(e.periodStart instanceof Date) || !(e.periodEnd instanceof Date) ||
      !Number.isFinite(e.periodStart.getTime()) ||
      !Number.isFinite(e.periodEnd.getTime()) ||
      !(e.periodStart.getTime() <= now.getTime() &&
        now.getTime() < e.periodEnd.getTime())) return false;
  return true;
}
