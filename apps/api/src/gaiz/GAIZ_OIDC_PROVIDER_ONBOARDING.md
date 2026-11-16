# ORGAIZ Standalone OIDC Provider Onboarding — security review

**Status: REVIEW-ONLY. No provider has been approved or activated.**

This branch prepares a **provider-neutral** approval and metadata validation boundary for standalone ORGAIZ sign-in. It does NOT choose an identity vendor, create an OIDC tenant/client, register redirect URLs, fetch discovery metadata, exchange real tokens, manage users, or enable login. It does not alter THEEPMO sign-in or tenant membership.

## New modules

- `gaiz-oidc-provider-policy.mjs`: validates separately obtained review records plus proposed OIDC metadata. The issuer, client, redirect, HTTPS JWKS URI and reviewer identity must be present and explicitly operator-approved. Enforces code flow, PKCE S256, permitted EdDSA/RS256 signatures and same-origin authorization/token endpoints. Rejects client/browser-supplied metadata overrides, unknown metadata keys and unapproved redirects or JWKS origins.
- `gaiz-reviewed-provider-broker.mjs`: binds validated metadata to the earlier transaction-only PKCE broker while requiring separately injected atomic transaction storage, code-exchange adapter and trusted JWKS provider. Produces no live session.
- Test suites `gaiz-oidc-provider-policy.test.mjs` and `gaiz-reviewed-provider-broker.test.mjs` cover refusal of unapproved providers and pure authorization URL construction.

## Mandatory operator review record (not a production config)
```json
{
  "status": "approved",
  "reviewId": "REPLACE-WITH-APPROVAL-ID",
  "approvedBy": "REPLACE-WITH-REVIEWER",
  "issuer": "https://approved-issuer.example",
  "clientId": "REPLACE-WITH-REGISTERED-CLIENT-ID",
  "redirectUri": "https://approved-orgaiz-host.example/auth/callback",
  "allowedJwksUri": "https://approved-issuer.example/keys"
}
```
The placeholder record must NOT be used as real approval. Review records must come from a trusted server-managed configuration or signed release process; merely submitting `status:approved` does not make a provider trusted. Never accept this object from an unauthenticated request.

## Manual validation, without GitHub Actions

```sh
node --test apps/api/src/gaiz/gaiz-oidc-provider-policy.test.mjs apps/api/src/gaiz/gaiz-reviewed-provider-broker.test.mjs
node --test apps/api/src/gaiz/gaiz-standalone-oidc.test.mjs apps/api/src/gaiz/gaiz-standalone-login-broker.test.mjs
```

## Decisions required before provider activation

1. Choose an actual supported OIDC issuer; approve its production metadata, security posture, data residency and privacy commitments.
2. Register a **dedicated ORGAIZ client** and exact HTTPS callback; choose client authentication and token endpoint requirements, and provision secrets only in server-side managed secrets.
3. Configure a pinned/allowlisted metadata and JWKS retrieval process, bound response sizes, rotation/expiry, DNS/rebinding protections and outage handling; never follow token-supplied JWKS URLs.
4. Implement a real backend authorization-code exchange, durable atomic single-use PKCE state store, server-side ORGAIZ session issuance, secure cookies and logout/revocation.
5. Implement separate customer record persistence uniquely by `issuer + sub`. An authenticated identity does NOT prove an EPMO account, a purchase, or report access. Paid entitlement and each artifact authorization are separate.
6. Run staging login, CSRF, code-substitution, replay, refresh, expired/revoked session and multi-device tests.

**No merge, deployment, DNS, payment, database migration or environment change is authorized.**
