# GAIZ disposable quarantine acceptance (not executed)

The GAIZ integration remains unregistered and disabled. The SQL documents in this
directory are **review proposals**, not migrations and must never be applied to a
production database without a separate approved change.

## Preconditions
- Disposable PostgreSQL 16 environment with `tenants`, `users`, `memberships`,
  `audit_events` and the existing TEBE tenant role established using the
  official supported database setup.
- Review/reconcile `PROPOSED_ADDITIVE_SCHEMA.sql` and
  `PROPOSED_RLS_REVIEW.sql` with actual migration ledger, database grants and
  `packages/db/sql/rls.sql`. Do not run conflicting policies twice.
- Synthetic actors in tenant A and tenant B with active memberships; no customer
  records, production keys or network artifact references.
- A disposable service role without `BYPASSRLS`, not a superuser or table owner.
- Review retention and storage encryption (ciphertext remains customer data).

## Required executable checks before activation
1. Insert a synthetic `GAIZ1\\n` envelope under tenant A and verify a
   quarantine-only receipt with `importAllowed=false` and SHA-256; no plaintext
   or encryption key is returned or logged.
2. Re-submit same request with identical tenant, actor, idempotency key and
   bytes. Expect the same quarantine ID, no second audit write.
3. Same key and different ciphertext: reject and leave the original bytes,
   hash, state and audit record unchanged.
4. Two concurrent submissions under the same tenant and key: at most one insert
   and one audit; the second request returns the existing receipt only if
   digest/actor match.
5. Different tenant but same idempotency key: independent namespaced receipt;
   A cannot read or update B's metadata or ciphertext.
6. Unknown/cross-tenant session, inactive membership, absent capability, bad
   UUID, unsupported header and oversized bytes: reject without side effects.
7. Exceed 100 active items or 256 MiB per tenant: fail; verify concurrent quota
   checks serialize via transaction-scoped advisory lock.
8. As application role, `SELECT envelope_bytes` is denied, even with correct
   tenant setting. Metadata-only SELECT is tenant-scoped. No tenant context
   returns no metadata and forbids inserts/updates.
9. Attempt to forge a verified status or bypass issuer checks through the
   public layer: routes must still be disabled; no import record is created.
10. Verify crash/retry and transaction rollback leave no orphaned audit
    receipts. Test expiry, retention deletion, backup rotation and storage
    encryption using the approved worker identity.
11. An import job can be created as quarantined with a `quarantine_ref` but
    without an `artifact_ref`; subsequent verified states require a valid
    same-tenant artifact reference.
12. Signature and AES-GCM verification must be performed on the exact
    recovered ciphertext whose SHA-256 matches the immutable receipt.

## Inspection commands (after an isolated local checkout)
```sh
node --test apps/api/src/gaiz/gaiz-intake.test.mjs
node --test apps/api/src/gaiz/gaiz-workflow.test.mjs
pnpm build:packages
pnpm --filter @pmo/api typecheck
pnpm verify:rls

# Only after an independently reviewed disposable PostgreSQL setup:
GAIZ_DISPOSABLE_DATABASE_URL="postgres://gaiz_test_role:...@127.0.0.1:5432/gaiz_disposable_test" \\
GAIZ_TEST_TENANT_A="00000000-0000-4000-8000-000000000001" \\
GAIZ_TEST_TENANT_B="00000000-0000-4000-8000-000000000002" \\
node --test packages/db/src/gaiz-disposable-db-acceptance.mjs
```
No results are claimed for these commands. The read-only RLS/privilege and audited rollback
tests are now implemented as a dedicated opt-in runner, but **not executed**.
Quarantine concurrency, draft-import atomicity, seeded RLS fixtures and all
TO-produced interop acceptance still require real disposable-database runs.
The runner rejects privileged or non-disposable database names and requires two
synthetic tenant IDs; it skips when no disposable URL is supplied. GitHub Actions is not a substitute
for independent disposable RLS and concurrency evidence.

## Non-goals
No production migration, public file upload, arbitrary URL download, signed
capability issuance, recipient-key release, automated approval, import execution,
cross-tenant recovery, HTML rendering or security-gate bypass.
