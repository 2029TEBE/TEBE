# Paddle sandbox acceptance gate — exact-head review (2026-11-05)

**Current state: NOT commercially ready.** This candidate is a pure-source contract, not a Paddle account connection. No real payments, subscription grants, or database mutations have been made.

## Implemented in PR #432
- Synthetic OAuth-only CI fixture and authorization-first Excel import checks (port of #429).
- Offline sandbox checkout request preparation from server-owned tenant and catalogue values. It never trusts browser-supplied price or tenant details.
- Isolated Paddle API v1 transport adapter with fixed sandbox HTTPS origin, sandbox-key prefix, short deadline, no redirects, no automatic retries, and mock-injected tests; no customer route invokes it.
- Signed raw-body event identity verification and provider timestamp tolerance; offline settlement policy checks transaction, tenant, price, currency, amount, quantity and expiry.
- Subscription lifecycle preflight with event ordering and persisted watermark checks, no entitlement grant.
- Static Servitro staging declaration gate and additional synthetic scenario matrix.
- Remains fail-closed: current webhook returns non-success, checkout routes return 503, production payment flag remains false.

## Required before actual staging processing
1. Reconcile the Q91 Paddle ledger migration and RLS from PR #383 with the main migration chain; preserve old financial records and hashes. A test policy is not a transactional writer.
2. Implement server-owned checkout intent insertion, provider transaction response binding and single-receipt durable settlement in a tenant-locked SERIALIZABLE database transaction with unique provider IDs. Do not use webhook custom_data as tenant authority.
3. Persist raw-body HMAC-verified event identities and transaction hashes, reject replay across tenants, and handle race conditions with transactional locks. Only an eligible persisted payment can affect entitlements.
4. Implement refund, chargeback, adjustment, cancellation, resumption and out-of-order event reconciliation without client-supplied tenant identity.
5. Verify a *real* Paddle sandbox account, sandbox API token, price IDs, notification destination and signed sandbox webhook. Test all eight cases against real provider notifications and a disposable PostgreSQL tenant A/B fixture.
6. Resolve remaining dependency-audit findings. Verify that production-built API/Web work with locked dependencies and evidence from the exact SHA.
7. Keep production Paddle collection and domain cutover **OFF** until merchant approval, consumer/tax terms, support, backups and release authorization are recorded.

## Test evidence and limitations
The tests in `scripts/paddle-sandbox-acceptance-matrix.test.mjs` are synthetic and intentionally cannot prove Paddle, PostgreSQL or webhook delivery. PR #433 separately upgrades patched Next.js/Drizzle/proxy-addr/Multer but still requires full audit, API compatibility and code review. Never treat passing this checklist as approval to process live money.
