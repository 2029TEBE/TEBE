# ORGAIZ atomic session persistence — database review handoff

**Draft-only security foundation. Not registered, not deployed, no production migration or provider.**

## Purpose

The previous standalone session service draft used two separate adapter methods for identity upsert and token insertion. That is **not transaction-atomic** in PostgreSQL. This branch adds `gaiz-atomic-customer-sessions.mjs` as a replacement session-service implementation compatible with the OIDC callback and HTTP handler interfaces. It intentionally does **not** change production module wiring.

## Changes

- `issueFromTrustedCallback` validates a server-verified OIDC identity, then allocates a 256-bit opaque token and SHA-256 digest. Within **one database transaction**, it safely upserts by the unique `(issuer,subject)` identity and inserts the hashed session. It returns the bearer token only **after COMMIT**.
- Existing suspended or deleted accounts are **never reactivated** by an identity-provider callback: the upsert does not change `status`, and a non-active returned status rolls back.
- On insert, commit, account-policy or database failure, a best-effort rollback occurs and the token is **never exposed**.
- `requireCustomer` verifies session digest, customer status, expiry and revocation every time.
- `revokeAll` rechecks and locks the actual session row plus its customer row **inside the transaction**, then revokes every customer session; never trusts a browser-supplied customer ID.
- SQL uses parameterized values and a database pool with `connect/query/release`. No connection string or secrets are embedded.
- `gaiz-atomic-customer-sessions.test.mjs` uses a synthetic PostgreSQL client model to exercise transaction and rollback controls. These tests are **not yet executed** by this workstream.

## Required infrastructure before activation

1. Approve and apply the independent ORGAIZ customer/session migrations proposed in `docs/gaiz/PROPOSED_ORGAIZ_COMMERCE_SCHEMA.sql` and `docs/gaiz/PROPOSED_ORGAIZ_SESSIONS_SCHEMA.sql`. Those files deliberately contain **ROLLBACK** and must not be run as migrations. Write an independently reviewed production migration instead.
2. Confirm `orgaiz_customers(issuer,subject)` is UNIQUE, `orgaiz_customer_sessions(token_digest)` is UNIQUE, and customer and session rows are constrained by enforced ownership and expiry.
3. Create a dedicated least-privilege identity-service DB role with reviewed RLS policies; no public/marketing role access, no BYPASSRLS. A secure service-owned, audited DB policy must handle signup, lookup, account suspension, session issuance and revocation. No such policy exists in this PR.
4. Before wiring, review locking order and concurrency semantics under PostgreSQL `READ COMMITTED`, including concurrent callback, revocation, suspension and account deletion. Use a tested pool and transaction scope; no cross-request connection leaks.
5. Add server-side audit for session issuance, denial and revocation. Rotate sessions on privilege changes and key changes, enforce cookies, CSRF and TLS from the separate, unmounted HTTP preview PR #516.
6. Register separately approved real OIDC provider and token code flow from draft #517. Only trusted callback code may call `issueFromTrustedCallback`.
7. Validate with real PostgreSQL (not only the fake adapter), staging browser E2E, failure injection, TTL and replay scenarios before any release.

## Local unit tests (not claimed passed)

```sh
node --test apps/api/src/gaiz/gaiz-atomic-customer-sessions.test.mjs
```

## Safety / release

This is a source-only implementation step despite GitHub Actions queue issues. It **does not bypass independent authentication, row-level security, database migration, privacy or release review**. No merge/deployment or customer credentials are changed.
