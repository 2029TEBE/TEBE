# Auth0 candidate for ORGAIZ — review only

**Selected technical candidate, NOT an approved or activated identity provider.**

Auth0 is a possible hosted OIDC provider for standalone ORGAIZ customer accounts. This branch introduces a provider-specific metadata/issuer validation adapter and synthetic tests. It neither registers a real Auth0 tenant nor creates credentials, issues sessions, retrieves remote JWKS, grants an entitlement, or changes EPMO authentication.

## Candidate registration path (owner/admin action required)

1. Register or open the organization's own Auth0 tenant and select the correct tenancy/data region according to documented privacy and residency obligations.
2. Create a **dedicated ORGAIZ web application** suitable for a server-side authorization-code flow with PKCE S256, never reuse EPMO tenant sessions, OAuth tokens or customer passwords.
3. Agree on exact hosted login domain, issuer, callback URI, allowed logout URI, client ID, token endpoint authentication method, audit/retention/privacy practices and MFA/recovery expectations.
4. Obtain and independently verify the actual `/.well-known/openid-configuration`, `/.well-known/jwks.json` and security/organization approvals; record these in **server-controlled** release configuration only. Never accept approval records or provider URLs from the public browser.
5. Inject reviewed client credentials and secrets using dedicated server-side secret management; never commit them to GitHub. Execute cross-origin CSRF, nonce, key rotation, provider compromise and account-linking tests.
6. Activate only after durable atomic PKCE transaction storage, single-use code redemption, independent customer account ID persistence, secure cookie/session/revocation, verified purchase ledger and per-artifact authorization pass staging acceptance.

## Current code

- `gaiz-auth0-candidate.mjs`: recognizes a reviewed Auth0 tenant issuer and exact known authorization, token and JWKS paths. Provider discovery inputs remain supplied out-of-band; **no network calls are made**.
- `gaiz-auth0-candidate.test.mjs`: synthetic tests for approved-form metadata and rejection of swapped issuer, token endpoint, JWKS and unsafe flows.

Manual test (on an authorized Node 22 checkout):

```sh
node --test apps/api/src/gaiz/gaiz-auth0-candidate.test.mjs
```

**Release disposition:** Do not merge/enable/deploy until the actual Auth0 tenant, client and independent security approval exist. No payment, email, DNS, database or customer changes are performed by this branch.
