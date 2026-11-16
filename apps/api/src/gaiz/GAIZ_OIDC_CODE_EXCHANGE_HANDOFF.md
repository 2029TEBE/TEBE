# Standalone ORGAIZ — reviewed OIDC code exchange

**Status: development-only, not registered, not configured with a real client, not deployed.**

## Implemented

- `gaiz-oidc-code-exchange.mjs`: an inert, injected HTTPS authorization-code token adapter for independently approved OpenID Connect provider details. Requires a server-only client secret and an injected trusted fetch implementation. Supports `client_secret_basic` only; rejects unknown client/redirect/PKCE verifier, missing credentials, redirects, non-200 responses, unacceptable content types, oversized response bodies, malformed token types and missing ID tokens.
- `gaiz-reviewed-code-broker.mjs`: connects the existing reviewed OIDC provider metadata, the single-use state + S256 PKCE broker and the code redemption adapter, then verifies the returned OIDC ID token against independently trusted issuer JWKS. Does **not** create an HTTP controller or identity session.
- Dedicated synthetic negative tests `gaiz-oidc-code-exchange.test.mjs` and `gaiz-reviewed-code-broker.test.mjs`.

## Operational prerequisites

1. Approve a specific real issuer, client, redirect and token/JWKS endpoints in trusted server configuration, with issuer metadata verified separately. Auth0 remains an *unregistered candidate*, not a live connected identity provider.
2. Provision an authenticated server-only OIDC application secret through approved secret management. Never commit secrets, write them to logs, send them to TEFE or return them from a token-exchange handler.
3. Use a hardened network transport that pins approved hostnames/IP policy, validates TLS and DNS behavior, blocks SSRF/rebinding, forbids redirects and has bounded timeouts and bytes. The fetch adapter is injected; the module alone does **not** prove network-layer defenses.
4. Wire durable single-use PKCE state storage, trusted JWKS retrieval/rotation, strict nonce/audience/issuer signature validation, callback route, session cookies and customer account persistence from preceding review PRs.
5. Maintain rate limits, fraud/abuse checks, audit events, consent, session revocation and verified customer permissions. Login does **not** convey GAIZ purchase/download/import rights.
6. Complete actual staging E2E across callback replay, secret rotation, endpoint outages, forged token signatures, spoofed issuers, login CSRF, redirects and mobile browser cookie behavior.

## Manual validation

```sh
node --test apps/api/src/gaiz/gaiz-oidc-code-exchange.test.mjs \
  apps/api/src/gaiz/gaiz-reviewed-code-broker.test.mjs
```

Tests are authored; they are **not claimed executed**. GitHub Actions scheduling issues must not be bypassed for release or represented as green.

No production identity, provider or customer-account change is performed by this branch.
