# Stripe-only future payments — controlled switch-back

**Status: CODE PREPARED, NOT LIVE.** This change targets future THEEPMO
renewal invoice payments. It does not refund, reverse, re-charge or migrate
historical transactions, and does not turn existing one-time Checkout payments
into automatically recurring Stripe Billing subscriptions.

## What already existed in TEBE

- `StripeBillingService` and `BillingController` are registered in the
  authenticated NestJS application.
- The billing page offers **Pay securely with Stripe** for eligible **open
  renewal invoices**, with server-bound invoice ID, amount, currency, and
  tenant-scoped authorization.
- Hosted Checkout uses `mode=payment`, **not `mode=subscription`**.
  Renewal invoices are created by a separately authorized operation;
  a paid status is granted only after a valid Stripe-signed webhook.
- Receipt idempotency, refund/dispute exceptions, tenant subscription
  enforcement and payment history have existing implementation boundaries.

## What this change does

- Selects `BILLING_PROVIDER=stripe` in `.env.example` while retaining
  `STRIPE_ENABLED=false` until reviewed staging/live activation.
- The Stripe service now refuses to operate without an explicit
  `BILLING_PROVIDER=stripe` setting.
- When Stripe is selected, the legacy reference HMAC settlement webhook
  refuses payment settlement even if its old enable flag was set.
- The test-mode staging preflight requires Stripe to be explicitly selected.
- Adds offline source regression checks for checkout, webhook and provider
  selection. No credentials are committed and no payment is created.

## Sandbox activation checklist

1. Confirm which Stripe account actually belongs to THEEPMO / Orgaiz.
   The available connected account is **The Epmo sandbox** (test mode);
   do not treat it as production merchant onboarding or live authorization.
2. On a non-production staging deployment, configure
   `BILLING_PROVIDER=stripe`, `STRIPE_ENABLED=true`,
   `DEPLOYMENT_ENV=staging`, the **test** server secret key
   `STRIPE_SECRET_KEY`, the endpoint-specific
   `STRIPE_WEBHOOK_SECRET`, and a valid public HTTPS webhook URL.
   Never commit keys, log them or put them in browser code.
3. Configure the exact Stripe endpoint
   `/api/v1/billing/stripe-webhook` and required Checkout/payment
   success and refund/dispute events; test raw-body signature verification,
   retries/duplicate events, wrong tenant, wrong amount/currency,
   checkout expiration, failed payments and webhook delivery.
4. Run `node scripts/stripe-staging-preflight.mjs`, the complete Node
   suite, TypeScript build, PostgreSQL RLS/reconciliation acceptance and
   real Stripe **test-mode** end-to-end payment simulations.
5. Verify invoice creation and session reuse, signed settlement,
   subscription access changes, exceptions, audit, and rollback.
   Obtain security/finance release approval before connecting real payments.
6. For a **future live production** switch, first confirm Stripe merchant
   activation, supported country/entity, settlement currency, tax, fees,
   consumer terms, production domains, live secret keys and separate
   live-mode webhook signing secret. Keep existing billing records intact.
   Deploy only the reviewed commit, with reconciliation monitoring and a
   rollback. **Do not use sandbox credentials in production.**

## Important scope limits

- This implementation **does not support automatic recurring Stripe
  subscriptions** or first-time plan purchase. Those require a separately
  designed Stripe Billing `mode=subscription`, customer/price mapping,
  webhook-driven subscription lifecycle, proration/cancellation and
  cross-system reconciliation. Do not advertise automatic renewals yet.
- THEEPMO's current invoice-driven one-off Checkout is unchanged.
  Orgaiz storefront checkout is a separate future integration; do not
  route marketplace purchases into the EPMO renewal invoice API.
- No provider history is erased, no historical payments are refunded,
  and no existing tenant subscription is re-created or canceled.
- No email provider integration is required or authorized here.

## Stripe catalog clarification — test account

The connected **The Epmo sandbox** currently lists no Stripe Products or
Prices. This does **not** prevent the existing renewal-invoice Checkout:
`stripeCheckoutParams` supplies Stripe `line_items[0][price_data]`
from the server-owned invoice amount and currency, in `mode=payment`.
No catalog products/prices need to be invented for this one-off renewal flow.

A future **automatic recurring subscription** or new-plan purchase would
need a separate reviewed Stripe Billing design, plan/price mappings, tax
policy, invoice and subscription webhooks, migration/cancellation behavior,
and separately authorized sandbox setup. Do not create live catalog records
or enable charges based on this draft.
