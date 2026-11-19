# AO PostgreSQL 16 tenant/replay acceptance — disposable CI only

**No production database migration or AO runtime activation.** A new restricted-login adapter test has been proposed; its CI result must be independently checked. This test package runs only against an explicitly acknowledged, new, local PostgreSQL database named `ao_ci_isolated` on `127.0.0.1:5433` using synthetic data.

## Checked properties
- A non-login, non-superuser role without `BYPASSRLS` has SELECT/INSERT permission only.
- The reservation table has `FORCE ROW LEVEL SECURITY`, transaction-scoped tenant checks and a composite primary key on `(tenant_id, request_hash)`.
- Missing tenant context reveals no rows. Tenant A cannot select, insert or mutate Tenant B's rows. Explicit `approved` state insertion is rejected.
- Duplicate nonce insertion is idempotent. Two separate PostgreSQL sessions demonstrate that a pending unique-key collision blocks a contender and a subsequent identical retry inserts no second row.
- Test scripts refuse all unacknowledged, nonlocal, nonstandard-port or non-disposable database targets; CI uses an ephemeral PostgreSQL 16 service and fixtures with no customer information.

## Commands in isolated development CI
The CI job runs `bash -n` on the scripts, a Node source contract test, then `bash packages/db/scripts/ao-isolated-smoke.sh` with the exact test-only environment from `.github/workflows/ao-isolated-postgres.yml`. These scripts are **not** installed on the production server or run as a migration.

## Unresolved release gates
- No `ao_task_reservations` migration in the real TEBE schema, production credential provisioning, grants, verified transactional actor/entitlement loader, or deployed service endpoint.
- An **additional disposable adapter integration test is proposed** in the current PR: a separate test-only restricted login (inheriting the fixture's SELECT/INSERT-only grants), a server-owned synthetic entitlement table, real reserved PostgreSQL connections and two competing requests through `createAoReviewReservation`. It verifies replay/collision, cross-tenant and revoked entitlement denials. This remains an ephemeral CI fixture, **not** production service-account, authenticated NestJS/session/approval or entitlement-race acceptance.
- No immutable customer audit, retention/expiry, explicit signed Studio workflow approval, tenant-entitlement revocation race coverage, OT Windows/Chrome end-to-end, KMS/OAuth/MCP egress, staging release readback or licensing acceptance.
- The source-only AO reservation API in PR #674 must remain unmounted and return `executionSupported:false`, `grantIssued:false`. All original GIZE source IDs remain unchecked unless independent end-to-end evidence meets their full wording.

Related: GIZE tracker [#642](https://github.com/2029TEBE/TEBE/issues/642); reconciled source-only [PR #674](https://github.com/2029TEBE/TEBE/pull/674).

## Restricted-role integration extension (2026-11-19)

The reservation adapter previously read its immutable replay row with `FOR UPDATE`. That required table UPDATE privileges not granted to the restricted fixture role. The revised source uses a normal SELECT following PostgreSQL's unique-key conflict serialization, which is valid here because the test role has no UPDATE or DELETE on the reservation table. The integration test runs against PostgreSQL with an actual least-privilege login and executes the unchanged unmounted source adapter; it does not install any product schema or start AO tools. `ao_ci_actor_rights` is synthetic server-owned data and **not a production authorization implementation**. It is not evidence of real SSO, workflow approval, entitlement-revocation races, or paid-customer readiness.
