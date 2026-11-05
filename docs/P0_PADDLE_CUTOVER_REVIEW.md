# P0 Paddle-only billing safety cutover — review branch

## What this change accomplishes
- Retires **reachable** legacy checkout/webhook routes and removes the retired provider from NestJS module wiring.
- Prevents the billing page and browser POST routes from initiating new charges, invoice renewal requests or unverified cancellation/resumption.
- Selects Paddle in configuration but keeps all payment collection disabled. Rejects contradictory retired provider enablement on API boot.
- Preserves tenant-scoped reads and original financial ledger/migration history for audit, accounting, dispute and refund review.
- Returns 503 (not 200) for unimplemented Paddle callbacks to avoid falsely acknowledging settlement.

## Not yet a completed live migration
Paddle merchant approval, hosted checkout product/price identifiers, provider API transport, a **server-owned tenant/subscription intent**, verified Paddle-Signature raw-body callback, transactional replay-safe PostgreSQL settlement, subscription lifecycle reconciliation, real sandbox receipts and staging tenant A/B proof are **not provided here**.

**Do not merge or deploy for paid customer launch** merely because the source checks pass. A 503 Paddle endpoint is deliberately not a working PSP integration. Existing subscription records are displayed without initiating a new entitlement.

## Pre-release integration checks
1. Reconcile this main-targeted safety PR with existing stacked Paddle PRs #383, #391 and #392; those branches are review-only and not automatically merged.
2. Confirm signed provider events cannot be replayed, cross-tenant matched, or settled before durable SQL commit.
3. Verify refund, dispute, cancellation, subscription updates and webhook ordering in real Paddle sandbox.
4. Verify legacy provider credentials cannot reach active runtime, audit historical receipts without mutating them, and check support/legal/tax approval.
5. Run backend exact-head full CI and staging acceptance. Main CI currently has pre-existing failures; do not waive them.

No production server, DNS, mail, billing secret, database or customer record is changed by this branch.
