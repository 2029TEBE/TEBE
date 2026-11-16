# GAIZ standalone customer report API — source-only / unmounted

**Payments remain deferred. No customer billing, Stripe/Paddle or entitlement grants changed.**
This PR adds service and HTTP handler contracts that are intentionally not
registered in the EPMO NestJS app. The existing `GaizCustomerController` is
an **EPMO tenant preflight** and must never be confused with a standalone
ORGAIZ customer sign-in or purchases controller.

## Added
- `gaiz-customer-report-service.mjs`: independent ORGAIZ OIDC session only,
  public tool list, bounded server-catalogued report request, owner-bound
  job status and conditional private artifact download. Admission uses an
  injected server-resolved product and policy. The injected
  `jobs.submitFromEntitlement()` must atomically validate active customer,
  verified product entitlement, unique customer/order binding, order state,
  idempotency key, request quota and worker registration before job insertion.
- `gaiz-report-http.mjs`: **unmounted** first-party HTTPS handlers for tool
  catalogue, POST report submission, GET job status and GET attachment download.
  Submission accepts only `{orderId,idempotencyKey,request}` from an
  authenticated customer and resolves all trusted price/entitlement inputs on
  the server. Requires exact Origin, CSRF cookie/header and host+TLS.
- Attachment response is always `Content-Disposition: attachment`, private
  no-store with fixed filename and MIME for HTML/PDF/GAIZ artifacts, never an
  inline HTML page or publicly accessible storage URL.
- `gaiz-customer-report-api.test.mjs`: synthetic tests for ownership,
  refunded/revoked denial, request-shape rejection, CSRF and safe download
  headers. These are **authored, not claimed executed**.

## Critical pending integrations and review
1. Wire only to a dedicated standalone ORGAIZ customer host and approved
   OIDC middleware, not EPMO tenant AuthController or existing GAIZ EPMO
   session preflight. Existing EPMO route and authentication are unchanged.
2. Implement durable `jobs.submitFromEntitlement` as an atomic DB transaction;
   this PR intentionally contains no INSERT that could silently mint a paid
   entitlement. Any free-trial preview requires a separate explicitly
   authorized grant, not a bypass of payment verification.
3. Connect reviewed PostgreSQL job queue and actual encrypted object storage
   from draft PR #527. Complete RLS, schema migration and artifact integrity
   tests, including refund/revocation/read races and CSRF/session expiry.
4. Production HTTP adapter must use trusted TLS reverse proxy configuration,
   restrictive credentialed CORS, rate limiting, request byte caps, robust
   error handling, standardized status codes and audit logging. Reject state
   changes on GET; CSRF-protect report submission and account mutations.
5. Validate long-running polling, replay/idempotency, concurrent sessions,
   customer identity isolation, expires/revoked downloads, MIME sniffing,
   content isolation, static file security, and API error behavior.
6. Never deploy while tests, infrastructure/RLS review or identity provider
   verification are outstanding. No arbitrary client-supplied price, account,
   admin grant, worker key, filesystem path or code execution is accepted.

## Local checks
```sh
node --test apps/api/src/gaiz/gaiz-customer-report-api.test.mjs
node --test apps/api/src/gaiz/gaiz-queue-storage.test.mjs
```

**This PR is an implementation foundation, not a complete hosted service.**
