# AO v1 request reservation — storage and release handoff

**Status: review-only, unmounted, NO_GO for live AO execution.** This is an incremental TEBE source implementation and synthetic test fixture, not a new API, database migration, tool executor or successful OT-to-TEBE staging test.

## Preconditions before registration

1. Define and review a dedicated `ao_task_reservations` PostgreSQL table with `tenant_id UUID NOT NULL`, `request_hash` and `request_digest` (64-char lowercase SHA-256 hex), `principal_id`, `tool_id`, `task_id`, and a restricted state machine beginning with `pending_review`. Require a **unique constraint on (`tenant_id`, `request_hash`)**, without which `ON CONFLICT` is not a durable duplicate barrier.
2. Enforce **FORCE ROW LEVEL SECURITY** with tenant-scoped `USING` and `WITH CHECK` policies using verified `app.tenant_id` set transaction-locally. Test with a real restricted PostgreSQL login without `BYPASSRLS`. Never use unscoped administrative connection pools.
3. Implement a server-owned `verifyTrustedReadInTransaction` callback that locks and rechecks authenticated principal, membership, tenancy, active subscription, read-only tool registry/entitlement and revocation in the **same transaction**. No request JSON field or AO prototype result alone supplies authorization.
4. Test concurrent same-nonce attempts across separate PostgreSQL connections; exactly one row must be inserted, identical retries must reuse the reservation, changed payloads must fail without creating an operation. Verify two-tenant isolation, unique constraint, rollback, revoked principals, database disconnections and failed commits. The current unit tests use an injected mock pool **only**.
5. Implement append-only, privacy-minimized event evidence, retention/expiry and secure cancellation/revocation. Review data protection requirements and credential custody. A reservation has `executionSupported:false` and `grantIssued:false` forever; an independently approved runtime would need its own guarded execution pathway.
6. Reconcile with merged OT AO schemas [#79](https://github.com/faisalwrokksa-hub/TO/pull/79), disabled Windows/Chrome handshake [#80](https://github.com/faisalwrokksa-hub/TO/pull/80), and TEBE GIZE [source checklist](./GIZE-SOURCE-CHECKLIST.md). Preserve .gaiz/.gize wire formats and upstream AGPL attribution.

## Source scope

- `apps/api/src/gaiz/ao-review-reservation.mjs`: unregistered, injected-Pool proof of a tenant-context transaction plus hash-key duplicate reservation and fail-closed behavior.
- `apps/api/src/gaiz/ao-review-reservation.test.mjs`: synthetic invalid identity, mutation collision, unauthorized role/risk, rollback, and successful identical replay cases.
- `.github/workflows/ci.yml`: mandatory source-guards invocation; do not infer real database or device acceptance from passing synthetic tests.

**Release status:** no production database schema, no runtime wiring, no privileged execution, and no paid-customer readiness claim.
