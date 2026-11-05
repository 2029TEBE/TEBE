# THE EPMO — Subscription and billing (Paddle cutover)

**Status: read-only.** Paddle is the intended payment provider. New online checkout, renewal invoicing, cancellation, and resumption are not yet available. Do not attempt to pay or send card details through this application until an approved Paddle checkout is announced.

1. Open **Subscription and billing** with an authorized workspace administrator account.
2. Review the existing subscription status, plan details and available historical invoices. These records remain accessible for reconciliation and audit.
3. Existing prices shown in saved records are historical information, not a current binding checkout offer.
4. The platform cannot initiate a new payment or independently extend a subscription during the cutover.
5. A future Paddle payment will be considered verified only after the backend accepts a valid, signed provider webhook, matches it to a server-owned tenant/subscription checkout intent, and durably records a non-replayed settlement.
6. Returning from a payment provider, an invoice URL, or a browser success page never proves successful payment or activates access.
7. For renewals, plan changes, cancellations, refunds or disputes, contact your platform administrator for a verified manual review until the provider-backed workflow is approved.

**Release boundary:** Paddle merchant approval, sandbox credentials/price IDs, native provider transport, tenant-isolated ledger settlement, webhook replay protection, operational evidence and staging acceptance remain required. No live billing is enabled by this code change.
