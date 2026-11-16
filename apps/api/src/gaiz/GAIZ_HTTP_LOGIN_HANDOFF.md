# ORGAIZ first-party HTTP authentication adapter — PREVIEW CODE, NOT ROUTED

**Scope:** Developer-reviewed, framework-neutral HTTP handler contract for a separately hosted ORGAIZ customer identity service. It is **NOT imported into TEBE AppModule**, is not a live Nest controller, and no URL or cookie changes occur in production.

## Included
- `gaiz-standalone-http.mjs`: explicit-disabled handler factory requiring approved HTTPS first-party origin, OIDC broker, verified callback and persisted session service.
- `begin`: requires first-party Origin and TLS, generates random 256-bit prelogin binding cookie `__Host-orgaiz_login`, begins OIDC code + PKCE and performs 303 redirect to the trusted provider.
- `oidcCallback`: accepts only exact state/code query shape and valid prelogin binding cookie, always clears it, uses trusted server OIDC callback, sets `__Host-orgaiz_session` `HttpOnly Secure SameSite=Lax` host-only cookie on success; separate first-party CSRF token cookie; then 303 redirects to the approved account path. No token returned in JSON or URL.
- `current`: checks the live session and responds with minimal identity status; never returns a session token or EPMO membership or GAIZ payment entitlement.
- `logout`, `logoutAll`: require same-origin TLS, CSRF header matching cookie and server-side revocation, then clear first-party cookies.
- `gaiz-standalone-http.test.mjs`: synthetic handler tests for security headers, missing/unsafe origin, prelogin binding, callback cookies, no token leak and CSRF logout rejection.

## Critical deployment prerequisites

1. Choose the real dedicated ORGAIZ public host. The host of the callback cookie and protected account routes must be the same reviewed first-party HTTPS site; a marketing-site cookie cannot be silently shared across arbitrary eTLD+1, browser origins or EPMO app hosts. Do not use a `Domain` attribute for `__Host-` cookies.
2. Complete the approved OIDC issuer and client registration. Build trusted server-to-server authorization-code + PKCE exchange, durable single-use state, nonce and JWKS rotation. Do not treat returned ID tokens as browser bearer credentials.
3. Implement and independently review a real NestJS module/HTTP adapter behind an explicit feature flag; **do not add login/callback to EPMO's current AuthController** and do not relax its TenantMiddleware, ModuleGuard, session or CORS protections. A separately hosted ORGAIZ service is preferable. This source file is intentionally not mounted.
4. Use a trusted HTTPS reverse proxy. `req.secure` must be derived from a constrained and verified proxy configuration rather than spoofable client headers; enforce trusted canonical Host and CSP/HSTS/referrer policy, disable cross-origin credentialed CORS, rate-limit begin/callback and prevent open redirects. Respect authentication error handling without leaking secrets.
5. Apply approved PostgreSQL migration/RLS; the reviewed persistent adapter must atomically persist identity+session, audit issuance/revocation, handle concurrent callbacks, session fixation, expiration and revocation races.
6. Add token rotation upon privilege change or reauthentication; review distinct cookie path/expiry/recovery policy, device logout and optional MFA. Re-check existing session on all state-changing HTTP endpoints. Check `Origin` and per-session CSRF for uploads, checkout, account changes and approvals.
7. Complete staging E2E with real browser and provider on desktop/mobile, including SameSite redirects, prelogin binding failure, token theft and invalidation, replay, unauthorized account, cross-origin, double submission, logout-all and customer data retention.
8. Verify payments, reports and artifacts independently: successful login does not confer GAIZ purchase rights or EPMO tenant import.

## Explicit no-launch status
No real OIDC provider, production cookie, migration, route, account or external service has been configured. No UI sign-in is activated. Tests have been written but have NOT been executed as part of this change. GitHub Actions startup failures are not a prerequisite to further coding, but no security bypass or production merge is permitted without staging and independent approval.

Suggested local check when an isolated Git checkout is available:
```sh
node --test apps/api/src/gaiz/gaiz-standalone-http.test.mjs
```
