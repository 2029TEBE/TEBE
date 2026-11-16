# GAIZ transactional report submission — security and integration handoff

**Status:** Draft source only. Not mounted, scheduled, migrated or deployed. Stripe/Paddle work remains paused.

## Implemented

`gaiz-transactional-report-jobs.mjs` adds a disabled-by-default implementation of the `jobs.submitFromEntitlement` and `jobs.getOwnedJob` methods required by draft PR #528. It is stacked on PRs #526-#528, and keeps standalone ORGAIZ customers separate from EPMO tenants.

Inside one PostgreSQL transaction the submission method:
1. Locks and authenticates the canonical customer-owned order and the active customer record.
2. Handles an identical request idempotently using a server-hashed idempotency key and full payload digest; mismatching replays fail.
3. Allows only an order in `paid` state that has no prior report job.
4. Locks an active, non-expired, owner-bound order entitlement with `granted_by='verified_payment'` and **requires a separate trusted `settlementVerifier.requireSettledOrderInTransaction` check on the original verified settlement ledger**. A text flag alone is not a settlement.
5. Uses an injected server-owned tool policy *inside* the transaction to check active product, worker allowlist, report format and quota.
6. Inserts one queued report job, updates the locked paid order to queued using an optimistic revision check, and writes the audit record in the same transaction. Returns a job only after successful COMMIT; errors rollback and fail closed.
7. Provides customer-scoped status lookup, requiring a live active customer.

`gaiz-transactional-report-jobs.test.mjs` contains synthetic tests for normal issue, identical/mismatched idempotency replay, unpaid/suspended/unauthorized orders, invalid settlement provenance, insertion/optimistic-lock failure rollback and owner-scoped lookup. **These tests were written but have not been executed.**

`docs/gaiz/PROPOSED_ORGAIZ_REPORT_SUBMISSION_SCHEMA.sql` proposes one-job-per-order and idempotency uniqueness. It is deliberately wrapped in `BEGIN ... ROLLBACK` and **does not apply a migration**.

## Remaining requirements before activation

- Implement a genuine **settlement verifier** using the same database transaction, immutable provider-verified ledger rows and revocation state. This integration is deferred with payments, so no customer report jobs can be authorized through a fake paid event or client-provided flag. A separate free-demo flow would require explicit product/security approval.
- Review `orgaiz_jobs` idempotency and request digest columns, one-order-per-job uniqueness, `orgaiz_order_entitlements` provenance, index creation on historical data, row-level security policies, dedicated roles, input retention and outbox/audit. Design and apply a versioned real migration only after review.
- For concurrency, use real PostgreSQL tests with multiple connections and isolation/rollback, identical and different idempotency keys, suspended customers, entitlement revocation races, and inconsistent prior order states.
- Connect the queue from #527, encrypted artifact storage, and the customer HTTP boundary from #528 only after the database policies and credentials are verified. Rate limits, authentic OIDC customer session, CSRF, timeout, storage data locality, key custody and report download revocation remain mandatory.
- Ensure that transaction commit plus subsequent application-level audit cannot report a false failure; the database audit written here is authoritative, and any optional extra notification must be best-effort/outbox-driven.
- Run all relevant unit, integration, browser and storage suites in staging before merge/release.

## Manual checks (not yet run)
```sh
node --test apps/api/src/gaiz/gaiz-transactional-report-jobs.test.mjs
node --test apps/api/src/gaiz/gaiz-customer-report-api.test.mjs
node --test apps/api/src/gaiz/gaiz-queue-storage.test.mjs
```

No customer record, paid entitlement, production route, or production database was created or modified.
