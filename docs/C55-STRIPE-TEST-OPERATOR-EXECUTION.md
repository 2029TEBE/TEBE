# C55 — Stripe recurring TEST: single operator execution plan

**NOT RUN against Stripe; real provider receipts 0/7; release NO-GO.** This is a nondeploying, review-only handoff. Never use LIVE keys, customer data, real money, public customer checkout, or unapproved staging. Never commit cookies, emails, raw Stripe events, credentials or webhook signatures.

## Prerequisites and exact operator commands

Pin the checkout to the newest independently green canonical review-only SHA (Q77 `d5ef5065f2c1794f7956b837c968bfd4c8374762` is a historical starting point, not a permanent pin). Independently attest that the approved isolated HTTPS staging images run that same SHA; the operator's SHA environment variables are **not** deployment attestation.

The authorized Stripe/staging owner must provision a restricted `sk_test_` key, `whsec_` signing secret for `https://api-staging.theepmo.com/api/v1/billing/stripe-webhook`, `STRIPE_TEST_OPERATOR_SECRET`, approved server-owned recurring TEST `price_` map, two separate disposable tenant admin sessions/UUIDs, restricted non-BYPASSRLS PostgreSQL reviewer, independent QA reviewer, and explicit isolated TEST staging authorization. All secret values are injected from an approved secret manager, never echoed or stored in GitHub.

Nonsecret operator inputs: `EPMO_STRIPE_TEST_AUTHORIZATION=YES_AUTHORIZED_TEST_ONLY`, `EPMO_STRIPE_TEST_EXACT_SHA`, `EPMO_STRIPE_TEST_DEPLOYED_SHA`, `EPMO_STRIPE_TEST_TENANT_A`, `EPMO_STRIPE_TEST_TENANT_B`, `EPMO_STRIPE_TEST_REVIEWER`; staging flags `DEPLOYMENT_ENV=staging`, `STRIPE_ENABLED=true`, `STRIPE_TEST_OPERATOR_ENABLED=true`, `STRIPE_RECURRING_CHECKOUT_ENABLED=true`, `WEB_ORIGIN=https://staging.theepmo.com`, `STRIPE_WEBHOOK_PUBLIC_URL=https://api-staging.theepmo.com/api/v1/billing/stripe-webhook`, `BILLING_REFERENCE_WEBHOOK_ENABLED=false`, and for production-built staging `STRIPE_ALLOW_TEST_MODE_IN_PRODUCTION=true`.

```bash
# Approved isolated operator machine, pinned source, secrets securely injected.
node scripts/stripe-staging-preflight.mjs
node scripts/stripe-recurring-provider-preflight.mjs
# ONLY after separate authorization: genuine read-only Stripe TEST Price GET.
node scripts/stripe-recurring-provider-preflight.mjs --provider-readonly
# ONLY after all seven real phases, private redacted evidence and review:
node scripts/stripe-recurring-operator-receipts.mjs /private/stripe-recurring-receipts.json
```

The C55 preflight sends **zero** provider requests without the explicit `--provider-readonly` flag. With it, the only outbound calls are GET `https://api.stripe.com/v1/prices/<server-configured-price>`, rejecting LIVE/nonrecurring/non-SAR/inactive prices. It creates no payment, checkout or webhook and cannot accept any of seven receipts. Missing inputs result in BLOCKED and exit code 2.

## Seven independently reviewed real Stripe TEST phases

| Required scenario | Operator action and independent evidence | Mandatory negative |
| --- | --- | --- |
| `first_customer_subscription_checkout` | On tenant A's authenticated `pmoa_admin` HTTPS staging session, POST `{}` to `/api/v1/subscription/billing/stripe/operator/recurring-checkout` with separate `x-epmo-stripe-test-operator-key` header; complete hosted TEST checkout. Provider readback must show `mode=subscription`, `livemode=false`, approved server-owned Price, tenant A binding. | Forged tenant/price/body, nonadmin or missing operator key denied. No customer-facing route. |
| `webhook_signature_verified` | Inspect actual Stripe TEST signed delivery to the exact API webhook; verify raw-body signature and provider event identity. | Tampered body/signature and unsigned request rejected without DB mutation. |
| `webhook_replay_idempotent` | Provider-controlled resend of the **same** signed TEST event; compare tenant ledger/entitlement before/after. | Exactly one receipt/payment; same event SHA-256; no extra grant or period extension. |
| `entitlement_activation` | Verify provider-paid recurring invoice, one matching tenant payment ledger row and active server-side entitlement. | Success redirect alone and forged/unsigned webhook cannot grant. |
| `failed_payment_access_policy` | On separate disposable TEST renewal fixture, use Stripe's TEST failed-payment method; observe signed `invoice.payment_failed`, `past_due`, no new grant, unexpired access per approved policy, expired access denied. | No paid ledger entry, no expired access grant, tenant B unchanged. |
| `subscription_cancellation` | On separate TEST fixture, cancel through Stripe TEST under **approved** immediate/period-end policy; verify signed event and effective entitlement revocation. | Replayed/out-of-order event cannot regrant. If policy unapproved, BLOCKED. |
| `cross_tenant_billing_isolation` | Separate A/B authenticated sessions and restricted PostgreSQL reviewer verify tenant-bound invoice/payment/entitlement and signed-event isolation. | Cross-tenant READ/WRITE/replay denied; A/B/A switch safe; disposable SQL probes rolled back. |

For each scenario collect UTC timestamp, exact source and independently attested deployed SHA, `livemode=false`, hashed event IDs (SHA-256, never raw IDs in Git), Stripe TEST provider readback, signature result, tenant ledger before/after counts, negative result, credential-free GitHub Actions run/artifact URL and named independent reviewer. Store raw material privately. The existing C52 validator only checks claim consistency and **always** reports `providerIndependentlyVerified:false`, `releaseAccepted:false`; independent provider/DB review is mandatory before any release gate changes.

## Commercial owner decisions and stop conditions

The existing [YES/NO owner request](https://github.com/faisalwrokksa-hub/THEEPMOTEST/issues/1#issuecomment-6560630952) requires approved **SAR prices and interval/trial, Saudi VAT inclusive/exclusive disclosure, renewal notice/retry/grace, cancellation effective date, refunds/proration/disputes, Arabic/English privacy/terms/billing/refund URLs, staffed support contact/hours/SLA, and separate restricted TEST staging authorization**. No approvals are implied by this plan.

STOP on missing authorization/HTTPS/credentials, LIVE mode, mismatched SHA, missing second tenant/reviewer, failed signature, idempotency or tenant isolation. Mark NOT_RUN/BLOCKED/FAILED; never fabricate PASS. EPMO3 collects provider and commercial evidence, EPMO1 reviews RLS, EPMO4 owns authorized HTTPS staging, EPMO5 independently reviews exact-SHA receipts in canonical issue #1. Keep `candidateSha:null`, `decision:NO-GO` until all nine release gates genuinely pass. No protected merge, DNS, purchase, public deployment, Entra consent or live payment authorized.
