# GAIZ Customer Session Preflight — EPMO-only, disabled by default

**Scope:** This is the first live-code integration point for verifying an *existing EPMO account session* and its active tenant. It is **not** standalone ORGAIZ account onboarding, GAIZ purchase/entitlement verification, vault authorization or artifact delivery.

## Draft endpoint

`GET /api/v1/gaiz/customer/session`

The route is mounted via `GaizCustomerModule` and protected by the existing TEBE `TenantMiddleware` for all `/api/*` requests. It also explicitly revalidates the httpOnly EPMO session cookie with `AuthService.principal` and compares the authenticated user ID and active tenant with server-side request context. It does not use a caller-supplied tenant ID or issuer key, and will not accept local-development header authentication without a real signed-in cookie.

**Operator gate:** Requires `GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED=true` in an approved environment. All other values cause **404**. This gate does not enable jobs, files, billing, imports or decryption. Apply normal deployment configuration review before enabling.

Success example (a real UUID is supplied by EPMO's authenticated session, not from a request parameter):

```json
{
  "authenticated": true,
  "tenantBound": true,
  "tenantId": "<active tenant UUID>",
  "identityProvider": "epmo-session",
  "verificationLevel": "authenticated-workspace-session",
  "gaizEntitled": false,
  "gaizDownloadAuthorized": false,
  "gaizImportAuthorized": false,
  "gaizIssuerVerified": false
}
```

The response has private/no-store cache controls and varies by cookie. The endpoint returns no customer email, password, session token, private cryptographic keys, licensing claims, recovery authority or tenant business data.

## Run without GitHub Actions

After dependencies are installed in an authorized local TEBE checkout:

```sh
node --test apps/api/src/gaiz/gaiz-customer.controller.test.mjs
pnpm --filter @pmo/api typecheck
pnpm --filter @pmo/api build
```

The unit harness transpiles the controller with TEBE's TypeScript dev dependency and injects isolated stubbed auth and tenant context. It covers disabled state, missing/expired cookie session, active tenant mismatch and permanent false GAIZ entitlements. It does not replace real authenticated HTTP tests against a running PostgreSQL-backed staging service.

## Real service prerequisites and security boundaries

1. Validate the existing EPMO session and active membership under TLS on a staging environment with representative owner/member/revoked-account cases.
2. Verify cookie and cross-site behavior between the public Orgaiz frontend and the EPMO app; the existing httpOnly SameSite=Lax cookie must not be weakened to make cross-origin marketing requests work. Prefer a reviewed OIDC authorization-code/PKCE broker or a server-side same-site entry flow for standalone ORGAIZ identity.
3. Establish customer purchase/entitlement identity separately from EPMO membership. **Do not require an EPMO subscription merely to receive a standalone paid report**.
4. Approve verified issuer-key distribution, tenant authorization, idempotent job and artifact endpoints, audit/replay controls and consent before claims beyond session status can be returned.
5. Maintain no route for GAIZ customer uploads/import until independent production security sign-off and explicit approval workflow.
6. The preflight endpoint itself does not expose a CSRF-sensitive mutation; avoid making any future authenticated job/approval operation a GET.

**Rollback:** Revert this draft branch or leave `GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED` unset. No migrations, DNS, payment, email, KMS, new tenant roles or production records change.
