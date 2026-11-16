# Payment Provider Direction — Stripe for Future Purchases and Subscriptions

**Requested decision:** use Stripe for NEW one-time GAIZ purchases and future recurring subscriptions. Retire experimental provider PR #519. Existing EPMO tenant subscription invoices retain their historical provider, payments, webhook receipts and entitlements. Do **not** reclassify an old legacy-provider purchase as Stripe or attempt to migrate saved payment methods automatically.

## What the repository already supports
- EPMO TEBE already has `StripeBillingService`, a Stripe Checkout endpoint for **existing renewal invoices** and a signed Stripe webhook service under `apps/api/src/platform/`. These remain in place and are NOT replaced by GAIZ changes.
- The EPMO renewal Checkout uses `mode=payment` on an invoice; this is NOT a complete Stripe Billing recurring-subscription management system. New recurring plans need separate `mode=subscription`, durable Stripe Customer and Subscription bindings, plan mapping, invoice/credit/refund and lifecycle handling.
- The GAIZ source-only Stripe modules added here are **unregistered and disabled**; no live merchant account or credentials have been configured.

## Implemented foundation
- `gaiz-stripe-checkout.mjs`: server-priced Checkout intent for authenticated standalone OIDC customer and canonical order, with strict environment/session URL validation. Checkout success/redirect is not a payment.
- `gaiz-stripe-webhook.mjs`: timestamp-checked constant-time HMAC verification of original raw Stripe webhook body; ignores unsupported event types and treats refunds/disputes as reconciliation. A paid Checkout event must be matched to a separately persisted Stripe Checkout Session and owner/amount/currency/environment.
- `gaiz-stripe-subscriptions.mjs`: recurring Stripe Checkout intent with `mode=subscription`, an already-bound Stripe Customer, server-priced monthly/annual plan, duplicate subscription denial and subscription/invoice webhook matching to immutable customer/subscription binding. These are reconciliation candidates, **not active entitlements**.
- `gaiz-stripe-payments.test.mjs`: synthetic checks, authored but **not yet executed**.

## Critical activation and migration gates
1. Confirm actual Stripe account country and eligibility, legal entity, physical business presence, verified bank account and tax/identity data in the account's real jurisdiction. Stripe does **not** list Saudi Arabia as a supported country for direct merchant onboarding as of 2026-11-16. Never put an arbitrary physical address or wrong registered country into Stripe; test-mode keys are not production authorization.
2. Obtain approved Stripe test keys (server-only), a distinct webhook signing secret for GAIZ, products and recurring/one-time Price IDs. Set explicit production versus staging mode guards. Never use third-party accounts or publish credentials.
3. Design separate server-only customer and order ID bindings, Checkout Session persistence, idempotency keys, uniquely claimed event receipts, locking/CAS, audit, refunds and dispute access revocation. Wire only after independent database and security review.
4. For recurring plans add **Stripe Billing** Customer+Subscription persistence, invoice-paid reconciliation (not status alone), failed-payment/dunning, pause/cancel, seat/upgrade/proration, portal access, term extension and reconciliation on delayed/out-of-order events.
5. Preserve all old legacy-provider subscriptions and purchase entitlements as historical records. Evaluate active legacy-provider customers individually: cancel at chosen period boundary, obtain new customer consent and create new Stripe subscriptions rather than assuming payment methods automatically transfer. Avoid double charging or customer access loss.
6. Register separate reviewed GAIZ ingress and customer billing controllers only when all security and staging tests pass. Do not weaken existing EPMO tenant middleware or modify the existing Stripe renewal endpoint without reviewing current tenants and invoices.
7. Validate genuine Stripe webhooks (payment, invoice success/failure, subscription created/updated/deleted, refunds, disputes) in staging with retries, duplicates and out-of-order delivery. Test account status, account currency/taxes and refund rules. Release only with approved rollback.

## Manual checks
```sh
node --test apps/api/src/gaiz/gaiz-stripe-payments.test.mjs
```

**No customer is charged by this PR.** No production flag, account, webhook, migration, checkout page, redirect or credential was changed.
