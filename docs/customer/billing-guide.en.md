# THE EPMO — Paddle billing

Paddle Billing is the selected payment provider. The merchant registration portal is not a customer checkout page.

**Online payments are not yet enabled.** Workspace administrators may view their subscription and existing invoice history, but cannot purchase or renew a subscription online until the secure Paddle integration has passed acceptance.

A browser redirect is not proof of payment. Paid access is granted only after a genuine provider-signed event is validated, persistently reconciled to the correct tenant and billing period, and independently checked by the server.

Before launch, THE EPMO must verify Paddle merchant approval, checkout domains, products/prices, webhook signature verification, idempotent PostgreSQL settlement, sandbox payments (including failure, refunds and replay), customer email and recovery, and operational rollback.

Historical financial records remain available for accounting; they cannot independently activate a Paddle-paid subscription. For help, contact your workspace administrator or THE EPMO support. Never send card numbers, keys or webhook secrets through chat or email.

**Status: Paddle migration in progress — checkout disabled.**
