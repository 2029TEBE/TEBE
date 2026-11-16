# Stripe-first payments — provider transition (2026-11-16)

## Decision and scope

Use **Stripe as the primary payment processor for all future THEEPMO / Orgaiz purchases, subscription invoices and renewals**. Do NOT initiate refunds, move existing payments, overwrite historical provider IDs, or silently change an existing customer's external billing agreement.

The current TEBE backend already implements authenticated tenant-admin Stripe Checkout on an *existing open renewal invoice*, signed Stripe webhook verification, idempotent payment recording, and payment-exception handling. The current Stripe Checkout uses `mode=payment`: **this is a manually invoiced renewal flow, not an automatically recurring Stripe Billing subscription**. The plan comparison page does not currently permit first-purchase self-service.

## Changes in this review branch

- Add `PRIMARY_PAYMENT_PROVIDER='stripe'` policy for future charges, with `BILLING_PAYMENT_PROVIDER` optional configuration. An absent value defaults to Stripe; an explicit different provider causes Stripe checkout to fail closed. This does not activate Stripe.
- Correct `billing=cancel` redirect to match the billing UI's existing cancel-state handling.
- Expose `GET /api/v1/subscription/billing/provider` with only accurately supported capabilities. It does not return account secrets or grant subscription access.
- Add static regression contracts for provider selection, signed webhook settlement and disabled/unimplemented new-purchase flows.
- Public TEFE pricing preview identifies Stripe as the intended payment processor but continues to state that **public checkout is not activated**.

## Required secure configuration (not provisioned)

Configure ONLY in the deployed API's secret manager, never in source code or browser:

- `BILLING_PAYMENT_PROVIDER=stripe`
- `STRIPE_ENABLED=true` only after acceptance in the target environment.
- `STRIPE_SECRET_KEY=sk_test_...` on staging; live-only key in a separately approved production environment.
- `STRIPE_WEBHOOK_SECRET=whsec_...` for the exact webhook destination `POST /api/v1/billing/stripe-webhook`.
- `WEB_ORIGIN=https://<trusted-app-origin>` (canonical HTTPS origin).
- Verify database migrations 0014/0015/0018 and tenant RLS; do not apply migrations without isolated test results.
- Keep `BILLING_REFERENCE_WEBHOOK_ENABLED` disabled outside explicit local tests.

Set prices, currency and tax policy from an approved **server-owned** plan catalogue. Do not accept browser-defined amounts. A Checkout redirect is **not proof of payment**; access changes require verified signed Stripe events, matched invoice, exact amount/currency, and an idempotent ledger transaction.

## Product readiness and follow-up work

1. **First purchase:** implement an authenticated, tenant-bound plan selection and initial-invoice transaction; use Stripe-hosted Checkout with a server-derived price; provision entitlements only after verified settlement.
2. **Automatic subscriptions:** explicitly choose whether to use Stripe Billing `mode=subscription`, its Product/Price IDs, customer and subscription binding tables, and a complete recurring webhook lifecycle. Never label the existing one-time `mode=payment` checkout as automatic billing.
3. **Payment method and cancellations:** require a verified Stripe customer portal binding and explicit migration of any actual external recurring agreements. Current app cancellation is a local subscription policy, not remote Stripe Billing cancellation.
4. **Historical provider transactions:** preserve their provider/source ledger for refunds, reconciliation, disputes, audit and customer support. Do not fabricate or auto-refund transactions.
5. **Provider and acceptance:** confirm Stripe account ownership/eligibility, accepted merchant country, currency, tax settings, settlement account, test-mode webhook endpoint and secret, then execute real staging test card flow, replay, cross-tenant test, charge failure and refund/dispute QA. Only after those checks should live payment processing be enabled.

## Verification status

No Stripe account connection, secret provisioning, provider API request, real charge, database mutation, PR merge, or production deployment occurred when preparing this branch. CI has not been treated as a passed release gate. Provider selection is committed as a **reviewable development change**, not as a claim that payments are live.

## Stripe connected sandbox inventory — verified 2026-11-16

The user successfully connected the Stripe plugin. The available account is **The Epmo sandbox (test mode only)**. Read-only Stripe API queries established:

| Stripe resource | Count in accessible sandbox |
| --- | ---: |
| Products | 0 |
| Prices | 0 |
| Customers | 0 |
| Subscriptions | 0 |
| Webhook endpoints | 0 |

Therefore the sandbox is **not yet provisioned for initial purchases or automatic recurring subscriptions**. These checks say nothing about any unconnected live account.

Next tasks, without guessing commercial terms: confirm approved plan names, server-owned prices, intervals, currencies, and the tax treatment (inclusive/exclusive and whether Stripe Tax applies). Then create the sandbox Product/Price catalogue and webhook endpoint, implement subscription-mode Checkout, customer/subscription-to-tenant bindings, Customer Portal and the complete verified recurring lifecycle (including invoice paid/failed, subscription updated/deleted, disputes and replay). Keep test-mode separate from live keys and webhooks. Never grant access on a Checkout redirect.

No products, prices, customers, webhook endpoints or subscriptions were created in this inventory step. No charges, refunds, or production account changes occurred.

## Approved catalogue import guard (additional no-write step)

The seed file only contains `demo_seed_test_only` (price zero, SAR), a **disposable test subscription**, not a commercial price or approval. It must never be imported as a sellable Stripe plan.

Added `scripts/stripe-approved-catalogue.mjs` and negative tests. The function demands an explicitly approved manifest with a named approver, approval timestamp, plan code/name, currency, positive integer minor-unit price, interval, and confirmed tax collection/price behavior and country approval. It rejects empty/duplicate/malformed plans and unexpected extra fields. Its result is **dry-run only** with zero API calls, database writes or charges.

The connected Stripe account currently has **zero** products, prices, customers, subscriptions and webhook destinations and is **sandbox-only**. A final approved subscription pricing sheet, tax treatment and confirmed merchant jurisdiction have not been found in available Drive/Library/project sources. No catalogue entries were created, and no amount has been inferred from the demo seed.

After the approved manifest is obtained, compare it against the server-owned subscription_plans table and create matching products/prices **in test mode only** with a separately validated, reviewable Stripe change plan. Do not enable first-purchase checkout or recurring live subscriptions until the complete billing lifecycle and webhook acceptance are implemented and tested.

## First-purchase / recurring Billing contracts (additional no-write work)

Added `apps/api/src/platform/stripe-subscription-contract.mjs` with pure `mode=subscription` Checkout request construction, approved server-owned Stripe Price and revision requirements, exact tenant/plan binding, strict HTTPS return origin, and a separate completed-session validator that **never treats checkout as payment success**.

Added `apps/api/src/platform/stripe-recurring-settlement.mjs`, a conservative, pure recurring-invoice evidence gate. It requires independent verified webhook signature and Stripe API result, exact immutable tenant/customer/subscription/price/currency/amount references, paid invoice, active subscription and a single visible invoice line. Even a matching event only yields `eligible-for-atomic-review`, not an entitlement grant. This implementation targets a constrained legacy invoice shape and **must be adapted/verified against the actual selected Stripe API version**; do not wire it to live webhooks as-is.

Synthetic positive and negative source tests were added in `stripe-subscription-contract.test.mjs`. **No production endpoint, network request, price/product write, database migration, customer payment or subscription has been created.** The existing renewal `mode=payment` flow remains unchanged.

Before execution: approve a commercial catalogue/tax policy; obtain official Stripe Price IDs; provision webhook destination and account credentials; design unique tenant-bound customer/subscription linkage and idempotent invoice/event store; validate subscription lifecycle and current Stripe Invoice payload in isolated test mode; confirm cancellation and customer portal propagation; complete CI and external security acceptance.

## Unapplied Stripe Billing tenant-binding foundation

Committed as an **SQL proposal only**, not a numbered migration: `packages/db/proposals/stripe_billing_bindings_unapplied.sql`. Main's current migration journal ends at 0019, while the separate GAIZ draft uses migration identifiers 0020–0026. Do not introduce a conflicting 0020 Stripe migration; reconcile both branches and choose the next contiguous index only after GAIZ integration.

The proposal separates four security-authoritative concepts:

- Tenant-to-Stripe account/mode/customer mapping, with unique external Stripe customer association and tenant-scoped RLS.
- Independently approved Stripe Price catalogue mapping (server-only, with price revision and a second reviewer), never accepted from an HTTP request.
- Tenant-specific Stripe subscription + Checkout binding with composite foreign keys tying tenant, Stripe account/mode, customer, approved price, plan and catalogue revision.
- Replay receipt keyed by Stripe account/mode/event ID with tenant/binding composite FK and raw-payload digest, for a future atomic processing pipeline.

The ordinary `pmo_app` role gets **SELECT only** on these records when they exist; the RLS bootstrap now reapplies the read-only restriction after its broad general grants. All trusted registry writes require a separately authenticated and reviewed privileged billing worker, not yet implemented or authorized. A durable replay receipt and entitlement update **must occur in one appropriately locked database transaction**, not in independent webhook handlers.

A pure `stripe-billing-binding-policy.mjs` verifies a loaded tenant/price/customer/subscription identity before recurring settlement review and always reports `entitlementAllowed:false`. Schema and policy negative contract tests are included. These tests have not been independently executed in this turn; the proposed SQL is **not applied to any database**.

**Remaining blockers:** Approved pricing/tax catalogue, account webhook and credentials, real customer onboarding, Stripe API/version-compatible recurring invoice verification, billing-worker roles, isolated Postgres tenant/RLS and replay tests, complete subscription lifecycle and Customer Portal/cancellation parity, required CI and live-account onboarding. Do not imply that existing manually paid renewals are automatic subscriptions.

## Signed Stripe Billing webhook inspection (2026-11-16)

Added `apps/api/src/platform/stripe-billing-webhook-inspector.mjs` and negative tests. This **unwired, review-only** module validates Stripe's HMAC signature against the exact raw bytes, enforces a bounded body, correct test/live mode, typed object identity and event IDs, and records a SHA-256 payload identity for later replay-ledger comparison. Its output always reports `entitlementApplied:false`, `tenantAuthenticated:false` and `invoiceVerified:false`.

`classifyBillingEventReplay` differentiates new, finalized duplicate and interrupted events without ever allowing a payment or entitlement write. A different payload under the same provider event ID is rejected. This is a pure admission policy, **not** durable event storage or delivery acknowledgement. An authorized worker must later use the tenant-RLS registry and provider-account binding to identify the tenant independently of webhook metadata, retrieve authoritative invoice/subscription evidence from Stripe, and atomically lock, insert the replay receipt, reconcile funds and update the local subscription, with failure recovery.

**Important:** The account ID and endpoint signing secret must come from server-owned deployment configuration, never from webhook headers or clients. A verified Stripe event by itself does not prove customer entitlement or current invoice settlement. Stripe Invoice and Subscription object shapes must be validated against the current pinned API version before enabling any handler. No new HTTP endpoint, webhook endpoint, database migration, external Stripe resources, charges or paid access were created. Tests are committed, not yet executed or reported passing.
