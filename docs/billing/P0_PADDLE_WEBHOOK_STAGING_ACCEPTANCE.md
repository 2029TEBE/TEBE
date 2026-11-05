# P0 Paddle webhook ingress and sandbox acceptance — review-only

**Release state: NO-GO.** This branch does **not** enable real Paddle checkout, customer billing, invoice marking or entitlement activation. No live customer data has been modified. The new HTTP gateway is deliberately usable only on an explicitly acknowledged disposable GitHub CI database and returns 503 outside that environment.

## Architecture and threat boundaries

1. NestJS retains raw HTTP bytes (`rawBody:true`); a request must have a genuine `Paddle-Signature` HMAC over `ts:rawBody`, with a five-second timestamp window.
2. The exact `POST /api/v1/billing/paddle-webhook` route is the only signed callback exempted from interactive session authentication. The normal CORS, origin and rate controls remain active.
3. A tenant is looked up from a pre-existing server-owned Paddle transaction through `pmo_paddle_tenant_for_transaction`. The handler **never** trusts a webhook-supplied tenant ID or cookie to choose a workspace.
4. Completed-transaction receipts and settlements are written atomically under transaction-local tenant RLS, a tenant advisory lock and SERIALIZABLE isolation. An exact replay returns the existing settlement, conflicting content is rejected. HTTP 200 means durable receipt only.
5. Refund, credit and chargeback adjustments are recorded in `billing_paddle_adjustment_receipts`, with immutable unique event IDs, restricted application-role grants and FORCE RLS. Adjustments are presented read-only to billing administrators; there is no silent refund execution or subscription cancellation.
6. A separate offline policy evaluates **future** invoice activation eligibility. It does not update a database or grant access, even with mock merchant reconciliation.
7. Payment collection remains disabled by `PADDLE_ENABLED=false`. The CI-specific `PADDLE_LEDGER_WRITE_MODE=ci_disposable_only` gate also requires GitHub Actions, NODE_ENV=test and a local pmo_app disposable DB at localhost:5433. It cannot be activated on production.

## Real Paddle sandbox acceptance requirements (not yet performed)

- Explicitly approve a dedicated Paddle sandbox account, merchant terms, test price IDs, and scoped API tokens. Never place credentials in chat, GitHub source, workflow logs or example env files.
- Create a Paddle **sandbox** notification destination on a verified HTTPS staging endpoint, with endpoint secret stored in a managed secret store; configure transaction.completed, adjustment.created, adjustment.updated and relevant subscription lifecycle events.
- Implement and review a staging-only write policy with independently attested database identity, approved secret source, tenant/price ownership, retention and encrypted off-host backup. **Do not copy the CI flag into staging.**
- Execute Paddle's notification simulator and genuine sandbox checkout with test accounts only: success, failure, expired intent, duplicate delivery, tampered body, cross-tenant metadata, wrong price/currency/amount, adjustment.created, adjustment.updated, partial/full refunds, chargebacks, cancellation and out-of-order subscription events.
- Reconcile genuine provider transaction IDs, refund statuses and settlement hashes against disposable PostgreSQL. Distinguish `event_id` from `notification_id` and check provider order/watermarks.
- Implement and formally approve the durable **invoice paid → eligible subscription renewal** transaction separately. Refund/dispute reversals must be explicit, auditable decisions, not merely receipt events.
- Require green exact-head CI, zero critical/high dependency advisories, no sensitive logging, security review, restore drill and explicit owner approval before any domain, production or payment change.

## Source evidence and official documentation

- Paddle signature specification: https://developer.paddle.com/webhooks/about/signature-verification/
- Paddle transactions: https://developer.paddle.com/webhooks/transactions/transaction-completed/
- Paddle adjustment events: https://developer.paddle.com/webhooks/adjustments/adjustment-created/
- Paddle notification simulation: https://developer.paddle.com/webhooks/about/how-webhooks-work/

**Releases:** #431 fail-closed legacy cutover → #432 synthetic sandbox policy → #433 initial dependency hardening → #434 ledger → #435 atomic writer → #436 signed intake. #437 is separate Zod/image-size compatibility and audit remediation.
