# Paddle Sandbox staging ingress — implementation gate (review only)

Status: NOT IMPLEMENTED; production NO-GO. This is a backend-only design contract, not an authorization to deploy, collect payment, or grant entitlement.

## Verified baseline (2026-11-08)

- PR #444 CI run 42503811001 passed on commit 264e2dc.
- `PlatformModule` registers `BillingWebhookController` and `PaddleWebhookIntake`.
- `POST /api/v1/billing/paddle-webhook` receives the raw body and `Paddle-Signature`.
- `PaddleWebhookIntake.accept` invokes `ensureDisposableWriter`, which **rejects staging and production**. A deployed endpoint would return 503 rather than persist a real Sandbox callback.
- CI writer records receipts/settlements only, with `invoiceMarkedPaid=false` and `entitlementGranted=false`. Do not relax its CI guard.

## Proposed safe staging implementation

1. **Separate adapters and writers.** Keep `paddle-ledger-writer.ts` CI-only and immutable as a production boundary. Introduce a dedicated staging ingress service, independently enabled only by explicit `PADDLE_ENV=sandbox`, `DEPLOYMENT_ENV=staging`, `PADDLE_ENABLED=false`, and a staging-only opt-in. Never infer staging from hostname or missing env values.
2. **Isolated resources.** Require separate staging DB credentials/schema with no access to production tenant rows, and a staging-only Paddle webhook secret and Sandbox API key from secret management. Fail closed on missing or mixed environment configuration. No logging of secrets, signatures, raw customer data, or API keys.
3. **Authentication first.** Verify the exact raw bytes and `Paddle-Signature` with the Paddle SDK or an equivalently validated verifier, enforce timestamp/replay controls, content size limit and event schema. Reject unsigned, malformed and stale requests before DB reads or writes.
4. **Tenant authority.** Resolve tenant solely through an existing, server-owned transaction/checkout-intent binding after signature verification. Never use `custom_data` to choose tenant. Verify price, currency, amount, invoice, attempt, environment, subscription and transaction association within a tenant-scoped serializable transaction.
5. **Durable idempotency.** Persist an event receipt and verified Sandbox settlement atomically with uniqueness on provider event/transaction and payload hash. Identical replays may acknowledge; changed replays fail. Out-of-order adjustments must be durably queued or explicitly retried without acknowledging unrecorded events. No invoice-paid transitions, licensing, or entitlement grants in this phase.
6. **Operational safeguards.** Dedicated staging route with a stable public HTTPS endpoint; no production DNS switch. Restrict runtime credentials and outbound access, redact logs, audit failed verifications, and set an explicit retry/alert policy. Do not change the existing Paddle destination until the endpoint is deployed and verified.
7. **Release gates.** CI negative tests for forged signature, stale timestamp, malformed payload, cross-tenant transaction, changed replay, missing binding, duplicate event, out-of-order adjustment, DB rollback and environment mismatch. Then use a **genuine Paddle Sandbox notification** and reconcile provider event ID against staging receipt; separately verify no production rows, paid invoices or entitlements changed.

## Existing destination — preserve

Sandbox destination `ntfset_01m6y1zwm6k8dy398rrywa71e7` is currently configured for `https://app.theepmo.com/`, **not** the webhook route. Do not delete or recreate it, rotate its signing secret, or edit its URL before a staging endpoint and rollback plan are verified and the user explicitly approves the change.

## Scope and decision

Implementation belongs to the backend draft PR; no frontend changes. Passing synthetic CI does not establish genuine Sandbox acceptance. Merge, staging deployment, production deployment, live Paddle billing, and entitlement activation remain separate approvals. Track under #443 and #447.
