# ORGAIZ standalone customer sessions — development handoff

**Status:** Source-only foundation on a draft PR. No live login route, durable database migration, provider client, cookies, environment activation or production changes.

## Implemented

- `gaiz-customer-sessions.mjs`: disabled by default; requires injected durable store with uniquely keyed OIDC identities (issuer, subject). Issues 256-bit random opaque `ogs1.` tokens to an **internal, trusted server callback only**, persists only a domain-separated SHA-256 digest, and requires a live active customer and unrevoked/unexpired session on each lookup. Supports individual and all-device revocation, with all-device revocation revalidating the actual customer session token. Never grants GAIZ entitlement, EPMO membership, download or import rights.
- `gaiz-session-postgres.mjs`: disabled, unregistered, parameterized PostgreSQL adapter for customer upsert and session insert/read/revoke. Customer status is checked when a session is used; suspended/deleted customers are denied. Requires reviewed service database role and schema.
- `gaiz-standalone-callback.mjs`: after the existing approved OIDC broker has completed state/PKCE/code redemption and independently verified issuer, audience, signature, nonce and expiry, permits issuance of internal cookie material. This wrapper does not set or expose a cookie.
- Synthetic boundary tests: `gaiz-customer-sessions.test.mjs`, `gaiz-session-postgres.test.mjs` and `gaiz-standalone-callback.test.mjs`.
- `docs/gaiz/PROPOSED_ORGAIZ_SESSIONS_SCHEMA.sql`: review-only PostgreSQL proposal with digest unique index, expiration, revocation and FORCE RLS. No permissive policies; wrapped in ROLLBACK and **not applied**.

## Required for operational login

1. Register the approved OIDC client on the real provider. Verify callback URL and broker token exchange, state/nonce single-use storage, JWKS rotation and session binding. The prior Auth0 candidate is not itself a registered or approved tenant.
2. Review a real Postgres migration covering all ORGAIZ customer tables and session storage, least-privilege service roles, row-level policies, account suspension, secure backups, audit and retention. Commit and apply only through separately approved staging/database change control.
3. Register a **dedicated ORGAIZ callback controller**, not in EPMO's existing AuthController or TenantMiddleware. It must set the returned token exclusively as a `Secure`, `HttpOnly`, host-only, `SameSite=Lax` cookie (or stricter according to reviewed same-site frontend architecture), with short expiry and explicit path. Never return the token in JSON or expose it to JavaScript. Use TLS and reject unapproved origins. Do not weaken EPMO cookies.
4. Build protected `/session`, `/logout` and `/logout-all` endpoints, with CSRF protection on state-changing methods, rate limiting, no-store responses, optional reauthentication for all-device logout and comprehensive session fixation/rotation tests.
5. Confirm customer signup consent, privacy/data residency, retention, email verification policies, account recovery, brute-force defenses, MFA and incident revocation handling. All data remains separate from EPMO tenancy and superadmin access.
6. Integrate the verified ORGAIZ customer session with paid purchase ledger, order owner, job and artifact checks. The OIDC identity alone proves **no purchase**.
7. Test cross-site website behavior. The marketing site must not send cookies to arbitrary origins; use a reviewed first-party OIDC redirect/broker architecture.

## Explicit unresolved security requirements

- The `callbackVerified:true` argument and `verifiedByServer:true` data in pure functions **are not security credentials**. They must be constructed exclusively within trusted server-side functions after independent verification; never pass browser/user-supplied JSON directly.
- Postgres adapter functions are individual statements, not a fully implemented atomic signup+session transaction. A production adapter must add the required transactional boundary, concurrency guarantees, read-after-commit, revocation races and audit.
- No production RLS policy, migration, identity provider or repository checks have been passed by this change. The current scripts are **not a deployable session service**.

## Manual checks, independent of GitHub Actions

```sh
node --test apps/api/src/gaiz/gaiz-customer-sessions.test.mjs \
  apps/api/src/gaiz/gaiz-session-postgres.test.mjs \
  apps/api/src/gaiz/gaiz-standalone-callback.test.mjs
```

No merge, production deploy, customer account creation, payment connection or database migration is authorized by this draft.
