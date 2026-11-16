# Standalone ORGAIZ customer identity — security handoff

**Status: Development-only identity validation component. No registration, login endpoint, provider, customer DB, cookie, payment, or production session is implemented.**

## Why separate identities

The EPMO account model requires an active workspace membership. Standalone ORGAIZ report buyers MUST NOT need an EPMO tenant/subscription to receive their own purchased report. The standalone identity is keyed by **(issuer, subject)** from an approved external OpenID Connect provider, not by self-entered email, tenant header, GAIZ manifest or an EPMO global administrator account.

## Implemented

`gaiz-standalone-oidc.mjs` validates a signed OpenID Connect **ID token after server-side authorization-code exchange**:
- Externally configured HTTPS issuer, client audience, one-time expected login nonce and trusted issuer JWK set; never accept `jku`, `jwk`, `x5u` or unsigned tokens.
- EdDSA/Ed25519 or RS256 signature with a unique matching, allowlisted JWK and key algorithm/size checks.
- Expected `iss`, `aud`, `azp` when needed, `sub`, `nonce`, `iat`, `auth_time`, `exp`, a bounded login age and clock drift.
- Email returned only when `email_verified===true`; never use email as account identity.
- Every result has `gaizEntitled:false`, `gaizDownloadAuthorized:false`, `gaizImportAuthorized:false`, `epmoTenantBound:false`.

Unit tests: `node --test apps/api/src/gaiz/gaiz-standalone-oidc.test.mjs`.

This verifies signature/identity claims **only**. It does not prove an account has purchased anything or is entitled to any file.

## Required before a real standalone sign-in may be enabled

1. Select and approve an OIDC issuer/provider and register a dedicated ORGAIZ client and exact redirect URI. Do not invent production endpoints or credentials.
2. Implement a server-side authorization-code + PKCE broker with state/nonce bound to a short-lived, secure, HttpOnly, SameSite session and durable, single-use transaction storage. Never accept an ID token posted directly by an unauthenticated browser as proof of login.
3. Exchange the code server-to-server with validated TLS and issuer metadata, verify state/PKCE/nonce, validate tokens using separately retrieved, pinned/rotated trusted JWKS, then create an ORGAIZ-only server session. Guard refresh, logout, CSRF, replay, cookie scope and revocation.
4. Persist customers under a **separate** customer ID, unique by `(issuer,subject)`. Add privacy policy, retention/deletion, rate limits, audit and abuse protection. No EPMO memberships or tenant IDs are created by this process.
5. Integrate a verified payment/fulfilment ledger that maps the authenticated ORGAIZ customer to individual paid jobs/artifacts. Do not infer purchase from email or an OIDC identity token.
6. Authorize each download at the server using customer ID, artifact ownership, payment state, expiration and audit. EPMO imports require distinct tenant membership and explicit human approval.
7. Perform local+staging tests including login CSRF, code substitution, state/nonce replay, multiple audiences, mismatched issuer, revoked account, logout and concurrent sessions.

**Deployment gate:** No new auth route or provider keys are enabled by this change. No migrations, EPMO session/cookie policy changes, payment activity, DNS, merges or deployments.

## Rollback

Leave the review branch unmerged, or remove this isolated module. The code introduces no production registration, new customer records or persistent data.
