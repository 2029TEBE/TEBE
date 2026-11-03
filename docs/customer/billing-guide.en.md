# The EPMO — Subscription and billing (Paddle transition)

Paddle Billing is the selected **future** payment processor. Account registration at https://login.paddle.com/signup is for The EPMO merchant, not customers.

**Payments are currently disabled.** Existing authenticated Billing & Renewals screens remain read-only for historical invoice and subscription records. Do not initiate a legacy Stripe Checkout or treat a checkout return as paid access. Current customer enrollment remains invitation-request only.

After Paddle merchant approval, products/prices and sandbox credentials are provisioned, the engineering team must implement Paddle Checkout with server-owned tenant/price mapping; verify raw-body `Paddle-Signature` and process `transaction.completed`, `subscription.created/updated/canceled` into a durable tenant-specific ledger; exercise real sandbox payment, replay, failure, cancellation and isolation; and separately approve launch. Historical Stripe records are retained for financial/audit reconciliation and are never silently converted into Paddle payments.

Contact the workspace administrator or platform owner for billing assistance. Never send payment-card details, API keys, or webhook secrets in chat or email.

**Release status: Paddle migration in progress; not ready for paid subscriptions.**
