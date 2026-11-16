# ORGAIZ Paddle checkout and signed webhook foundation — review only

**Status: source-only. No payment routes, payment secrets, backend module registration, live checkout, ledger mutation or production deployment.**

## Ownership and separation

ORGAIZ is a standalone paid-report service. It does not automatically create EPMO tenant memberships, subscriptions or financial access. TEBE's existing Paddle billing modules under `apps/api/src/platform/` are for EPMO subscription billing and must remain unmodified. The standalone GAIZ layer uses separate customer identity, ledger, webhook destination and feature flags.

## Implemented code

- `gaiz-paddle-checkout.mjs` builds a provider transaction intent only for an authenticated standalone OIDC customer, canonical server-created order and trusted active product with one approved Paddle price. The checkout URL is verified against an approved HTTPS checkout origin/path and exact returned transaction ID; it is **not proof of payment**. Do not use EPMO tenant IDs in ORGAIZ checkout metadata.
- `gaiz-paddle-notification.mjs` verifies Paddle `Paddle-Signature` against the **unmodified raw request body**, with timestamp freshness, bounded body/header sizes and constant-time SHA-256 HMAC comparison. The event is parsed only AFTER verification. A signed `transaction.completed` is merely a candidate: it must match the server-owned durable transaction/order binding (transaction ID, customer, amount, currency, provider environment, state). Do not trust `custom_data` to establish ownership.
- `gaiz-paddle-event-processor.mjs` requires a durable store to claim each signed event once in a database transaction, lock and load its canonical order/transaction binding, validate the payment, transition `awaiting_payment -> paid` with optimistic revision and write an immutable audit record atomically. No paid entitlement is automatically activated by this source code. Failed/canceled transactions and adjustments are sent to a **reconciliation-required** path, never auto-marked paid.
- Two synthetic test files cover checkout spoofing, wrong price, tampered or stale signatures, wrong environment/underpayment, duplicate event, refund reconciliation and missing database adapters. **Tests are authored but not yet executed.**

## Implementation work still required

1. Merchant review and activation: verify an approved Paddle merchant account, one-time GAIZ price/products, commercial tax settings, checkout domain and separate ORGAIZ webhook destination. Confirm event types, sandbox/live segregation and any Paddle API contract changes against provider documentation.
2. Implement a bounded server-only Paddle API adapter with a secret manager, strict environment pin, stable request idempotency and verified transaction response; persist the checkout order and provider transaction binding safely **before** returning any checkout URL to the browser. Never embed a secret in a public repo.
3. Implement PostgreSQL atomic event processor with unique `(provider,event_id)` claim, unique `(provider,provider_transaction_id)` binding, event timestamp/hash, immutable audit, owner row lock, revision CAS and failure rollback. Duplicate legitimate notifications must return success without re-granting access, but any database failure must return non-2xx for provider retry.
4. Do not trust client-supplied `verifiedByServer`, `orderId`, `environment` or `amountMinor`. Those values are internal outcomes of independently authenticated provider message verification and server-owned database lookups.
5. Signed `transaction.completed` may arrive before checkout return or in different order. Implement delayed event binding/retry logic, replay windows, ordering and reconciliation; process refunds/adjustments by revoking access or documenting statutory delivery policy. Signed adjustments MUST NOT be silently discarded.
6. Ensure session cookies, CSRF, rate limits, authenticated checkout permission, immutable server price and tax details, fraud controls, consent, dispute handling and privacy review. Reject purchases by suspended accounts, quota-blocked customers and unapproved tools.
7. Register separately reviewed HTTP ingress for the raw-body webhook that is exempt from interactive tenant auth **only** after signature verification. Do not alter EPMO `TenantMiddleware` or existing EPMO Paddle webhook handling. Use a dedicated route with secure proxy body handling and audit.
8. Integrate with ORGAIZ bounded report workers, storage, refund/revocation policy, and EPMO optional import approval. Payment for a report does not confer decryption or import privileges.
9. Independently validate provider sandbox events for complete/cancel/failed/refunded/out-of-order/duplicate transactions, settlement amount/currency, concurrent purchases and tenant isolation. Complete security review before merge and production activation.

## Developer checks, not yet run

```sh
node --test apps/api/src/gaiz/gaiz-paddle-payment.test.mjs \
  apps/api/src/gaiz/gaiz-paddle-event-processor.test.mjs
```

**Release gate:** no auto-approval, merge, deployment, real customer charge or entitlement activation based only on this draft. GitHub Actions job scheduling may remain blocked while coding proceeds, but independent staging/security acceptance remains required.
