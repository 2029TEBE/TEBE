# THE EPMO — Paddle-only billing rollout

Current implementation is a **review-only, fail-closed source candidate**. The website and customer billing UI do not collect payments. The application accepts no signed payment callback as settled; provider billing remains disabled.

## Implemented
- Single active billing provider selector: Paddle; default collection disabled.
- Customer billing screen is bilingual and read-only, with historical invoice visibility.
- Disabled billing mutations return non-cached 503 responses.
- Unverified paid-access requests return a generic denial.
- New Paddle-native settlement schema has tenant isolation and append-only receipts.
- Synthetic raw-byte HMAC verifier and settlement preflight reject mismatched signatures, tenants, subscription references, currencies and amounts.
- Historical immutable database migration history and financial facts are preserved for accounting and rollback.

## Mandatory release blockers
1. Merchant account approval, separate sandbox and live credentials, domain and product/price approval.
2. Tenant-owned checkout creation and durable checkout intent, including safe provider retries and abandoned checkout reconciliation.
3. Registered HMAC-authenticated Paddle callback, provider-side transaction verification, transactional receipt/settlement persistence and event idempotency.
4. Provider-aware active/current-period entitlement verification, lifecycle/reversal/refund/cancellation handling, and periodic reconciliation.
5. Seven real sandbox acceptance scenarios, negative tenant A/B PostgreSQL tests and verified backup/restore.
6. Customer email and support, legal, refund and tax policy, exact deployed SHA, TLS, operational monitoring and independently approved cutover.

**Do not merge into production or enable paid collection based on synthetic CI alone.**
