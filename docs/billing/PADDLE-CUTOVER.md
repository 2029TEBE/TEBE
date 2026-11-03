# EPMO — Paddle Billing cutover, 2026-11-03

## Decision and safety

The merchant selected **Paddle Billing** instead of Stripe. https://login.paddle.com/signup is a **merchant account signup**, not a customer checkout and never proof of merchant approval or activation. This cutover remains **NO-GO** for paid customers until actual Paddle sandbox provider acceptance, signed ledger/entitlement persistence, account/domain approval, support/legal, and independent staging operations have passed.

- **Replace the active Stripe billing ledger with Paddle-native settlement tables** for all new payments: `billing_paddle_checkout_intents`, `billing_paddle_webhook_receipts`, and `billing_paddle_settlements` (additive migration `0023_paddle_ledger.sql`). Past Stripe payments stay separately identifiable as historical financial audit records rather than being rewritten with false Paddle transaction IDs.
- New deployments set `BILLING_PROVIDER=paddle`, `PADDLE_ENABLED=false`, and `STRIPE_ENABLED=false`. Both legacy customer billing mutations and Stripe webhook/test operator paths fail closed when Paddle is selected. Historical Stripe records cannot grant new paid-deployment entitlements in Paddle mode.
- The first Paddle raw-body signature verifier is source/test only, **not a registered webhook endpoint, billing engine or subscription settlement**. Do not ACK a Paddle event until a durable, idempotent, tenant-bound transaction is implemented.

## Required Paddle setup (merchant owner action)

1. Finish [Paddle merchant signup](https://login.paddle.com/signup) and obtain a **separate sandbox**. Record account setup status; do not paste credentials into chat or repository.
2. Create sandbox products/prices (Paddle price IDs `pri_...`) for approved plans, tax/currency/trial policy; configure default payment link and domain verification. Pricing must be approved independently.
3. Generate sandbox **server API key**, browser client-side token (`test_`), and notification destination secret (`pdl_ntfset_`). Store values **only** in a secret manager. Sandbox API origin: `https://sandbox-api.paddle.com`; live API origin: `https://api.paddle.com`; never mix credentials.
4. Build customer checkout with `Paddle.Initialize` and server-owned tenant/price binding. Never use the merchant signup URL as customer checkout.
5. Register HTTPS `POST /api/v1/billing/paddle-webhook` only when the handler persists transactions atomically. Authenticate `Paddle-Signature` over original raw bytes (signed `ts:rawBody`), reject tampering/replay, and process Paddle `transaction.completed`, `subscription.created`, `subscription.updated`, `subscription.canceled` and payment-failure/paused events.
6. Apply the new Paddle-native ledger schema only after the migration integrity and restricted-role RLS checks. Build the still-missing tenant-bound server writers, durable webhook reconciliation, idempotent event handling, refunds/disputes and cancellation access policy. The schema alone does not accept payments. The existing `paid-deployment` route is **Stripe-ledger-specific** and must be replaced with provider-aware verified Paddle authorization **after** safe migration.
7. Independently test real Paddle **sandbox** checkout, paid event, replay, tenant A/B isolation, failed payment, cancellation, refund/adjustments and renewal. None is accepted yet; external accepted receipts: **0**.
8. Separately approve live merchant identity and checkout domain, pricing/VAT/refund/support/terms, real email, Servitro SSL, live SHA, backup+restore and rollout.

## Pending PR cleanup

Old **Stripe-specific** drafts should be closed as *retired payment-provider work*, not merged or deleted. Historical code and financial records are preserved for audit. Keep one consolidated main-targeted review PR and only new Paddle migration PRs; infrastructure, email, RLS, and bilingual UI work remains in scope unless explicitly superseded.

## Source and evidence

Docs: https://developer.paddle.com/build/go-live-checklist/ ; https://developer.paddle.com/webhooks/about/signature-verification/ ; https://developer.paddle.com/build/subscriptions/provision-access-webhooks/ ; https://developer.paddle.com/sdks/sandbox/

**Status: PADDLE SANDBOX SETUP PENDING / CHECKOUT DISABLED / RELEASE NO-GO.**
