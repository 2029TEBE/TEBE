# P0 Paddle ledger migration reconciliation (draft, non-deployable)

This branch ports **exact, unchanged SQL migration bytes 0020–0023** from Q91 so their SHA-256 manifest remains immutable. Earlier migrations 0000–0019 stay unchanged. Migration 0021 carries historical Stripe recurring identifiers because it is an ordered accounting migration; **it does not re-enable Stripe processing or checkout**.

## Bounded changes
- Adds Q91's tenant-bound Paddle checkout intents, signed webhook receipt identities and append-only settlement tables.
- Adds the corresponding Drizzle schema to the existing main-based schema without replacing unrelated app definitions.
- Extends the normal PostgreSQL RLS installer to revoke UPDATE/DELETE for Paddle ledger rows and historical recurring bindings.
- Extends the financial RLS audit to fail on absent FORCE RLS, missing tenant policies or mutable Paddle ledger privileges.
- Runs the Q91 ledger checksum and relationship source assertions.
- No live data is migrated, no provider call is performed, no entitlement is granted.

## Mandatory acceptance before any merge or rollout
1. Exact-head CI must run all 24 ordered migrations against disposable PostgreSQL, including row-level security and restricted user checks.
2. Verify tenant A/B insert, query and duplicate-replay denial under a restricted pmo_app role, with no ability to update/delete any Paddle settlement, receipt or checkout intent.
3. Check production database migration history/checksums against this chain without modifying production.
4. Implement the server-owned checkout writer, transactional webhook settlement, provider lifecycle and ledger-to-entitlement rules separately. This schema is necessary but NOT a working billing integration.
5. Reconcile Q91 #383 and Q92 #392 and the existing #431–#433 review stack before approving any paid release.

**Payment collection remains disabled; no production deployment, database, secrets or customer data changes are authorized by this PR.**
