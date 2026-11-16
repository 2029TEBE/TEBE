# GAIZ report execution — payment integration deliberately deferred

**This branch continues GAIZ product development without implementing or activating payments.**
The new worker and first HTML report renderer are *development-only* and not registered
in the EPMO NestJS application, scheduled, deployed or exposed to customers.

## Implemented

- `gaiz-report-worker.mjs`: disabled-by-default server worker; no controller or background scheduler. Requires a durable server-only `queue.claimNext()` and fencing token. Independently validates a currently paid, processing, entitled order before invoking exactly one configured allowlisted handler. No dynamic imports or arbitrary code execution from user inputs.
- The handler receives a defensive structured clone of bounded JSON inputs, not a filesystem path, shell command, database role, secret or executable callback from the browser.
- Output constrained to an allowlisted format and MIME, size up to configured limit (default 2 MB), SHA-256 digest, and privately staged object. Final job and order success requires `queue.completeWithArtifact()` to return a confirmed committed transition.
- Failure uses a fenced `failClaim`; uncertain DB completion is NOT treated as success and does not blindly delete staged bytes that might have been referenced by a committed database transaction.
- `gaiz-executive-brief.mjs`: **first actual deterministic HTML report generator** (`gaiz.executive-brief.v1`) accepting a plain-text title, key findings and recommendations. Includes HTML escaping, bounded arrays and a strict CSP with no external JavaScript/assets. This report contains user-entered statements; it does not claim AI inference or independent verification.
- `gaiz-report-worker.test.mjs`: synthetic positive and negative tests for entitlement, job claims, lease expiry, output boundaries, commit failures and XSS. Authored but not claimed run.

## Important distinction: skipping payment work vs granting unpaid access

We have deferred all Stripe/Paddle work. **We have NOT bypassed purchase authorization**.
The worker requires a server-verified paid order; no request can set `paidOrder:true` over HTTP.
For internal demos, run the standalone renderer offline with synthetic data.
Do not create customer-visible artifacts from test or fabricated payment records.
A future, separately approved **free demo** must use distinct explicit demo permissions
and should never masquerade as a paid customer order.

## What's still needed to make this a real GAIZ product

1. **Durable job queue and worker store:** DB migration, dedicated worker role and RLS, atomic `FOR UPDATE SKIP LOCKED` claim, random lease token with bounded expiry, heartbeat, attempts/max retries, queue visibility, worker concurrency and backpressure, fencing on all state changes.
2. **Entitlement authorization:** real canonical job-to-customer-to-order ownership inside a DB transaction; validate account active, product/tool active, available quota and explicit paid access. No payment code modification on this branch.
3. **Artifact storage:** private, encrypted object storage, streamed byte and digest verification, encrypted key management, owner-bound pointer and expiry; safe quarantine/garbage collection of orphaned staged objects. Require conditional commit and revocation-check on every download.
4. **Report handlers:** connect approved template/analytics engines for other tools; never evaluate customer expressions. Separate PDF rendering and signed GAIZ2 package production need reviewed renderer and TO signer respectively. The HTML demo is real but deliberately simple.
5. **Customer experience:** report catalogue, submit/status/download APIs behind a separately approved identity service, rate limiting, CSRF, non-cacheable downloads, audit and data retention controls; EPMO tenants remain distinct.
6. **Cross-repository GAIZ2:** signed/encrypted export requires issuer-key custody, recipient consent and reviewed trust boundaries; no automatic EPMO import on report purchase.
7. **Validation:** run Node tests locally or in self-hosted test runner; actual PostgreSQL failure/retry/lease-race tests, storage outages and browser/XSS tests. Approve a staged release only after independent review.

## Manual tests (not yet executed by this PR)
```sh
node --test apps/api/src/gaiz/gaiz-report-worker.test.mjs
```

All production billing, authentication, DB roles, deployed apps and customer data remain unchanged.
