# GAIZ2 — TEBE integration and local verification runbook

**State:** Development-only. TEBE PR #504, TO PR #30, TEFE PR #43. No production merge, decryption, customer vault or database import.

## Implemented boundaries

- `apps/api/src/gaiz/gaiz2-verifier.mjs`: structurally validates GAIZ2 and verifies Ed25519 signature against an **independently trusted** issuer public key.
- `apps/api/src/gaiz/gaiz.controller.ts`: `POST /api/v1/gaiz/verify`. Registered through `GaizModule`, but disabled by default; refuses operation in `NODE_ENV=production`.
- Existing `TenantMiddleware` establishes authenticated user/tenant context; no caller-supplied tenant overrides. Existing module guard requires analytics360 entitlement, and controller requires `pmoa_view_financials`.
- `apps/web/src/app/(app)/gaiz/page.tsx`: signed-in preview screen; `apps/web/src/app/api/gaiz/verify/route.ts`: same-origin mutation validation and session cookie proxy.
- `apps/api/src/gaiz/fixtures/gaiz2-synthetic-v1.json`: pinned **public-only** fixed ciphertext fixture identical to TO and TEFE. Never trust its issuer as a real production issuer.
- Original GAIZ1 draft is unchanged and not silently upgraded.

## Optional local-only testing (no GitHub runner)

Run on a disposable developer checkout with Node.js >=22:

```sh
node --test apps/api/src/gaiz/gaiz-verifier.test.mjs
node --test apps/api/src/gaiz/gaiz2-verifier.test.mjs
node --check apps/api/src/gaiz/gaiz2-verifier.mjs
pnpm --filter @pmo/api typecheck
```

Production remains disabled. If testing the HTTP route on a local development instance, explicitly set `GAIZ_PREVIEW_ENABLED=true`, `GAIZ_PREVIEW_ISSUER_ID` and `GAIZ_PREVIEW_ISSUER_PUBLIC_KEY_PEM` in the **local process only**. Never commit trust configuration, keys, credentials or enable in production. A valid session with required entitlement/capability is mandatory. The route's maximum decoded body is **64 KiB** (distinct from GAIZ2's 8 MiB envelope maximum).

Example JSON body:

```json
{"artifactBase64url":"<base64url-encoded GAIZ2 artifact from a permitted synthetic fixture>"}
```

Expected result: a signature-verified receipt, SHA-256 hash, `authorizationGranted:false`, `importAllowed:false`. Wrong tenant, unsupported version, invalid issuer and tampering must be rejected.

## Current blockers and release conditions

- GitHub Actions under `2029TEBE` failed immediately without usable runner logs; **CI status is unverified**, not passed.
- Independently run TEBE tests/typechecks, including this API and Next.js UI, before merging. Tests added to the branch are not proof of execution.
- No persistent quarantine, signed audit storage, replay/idempotency table, entitled decryption service, schema mapping, human approval workflow, or transactional enterprise import exists.
- Do not grant import permission based solely on a valid signature or browser UI.
- TO owns canonical format. Proposed recipient RSA-OAEP must pass cryptographic review; trusted issuer registry and key lifecycle are not yet production ready.

## Manual review checks

1. Use a disposable tenant matching the intended fixture scope; do not weaken tenant binding to force a passing demo.
2. Confirm valid trusted artifact returns status only.
3. Confirm wrong tenant and wrong issuer return a safe error and no data is written.
4. Confirm anonymous, unlicensed and capability-denied requests are rejected.
5. Confirm the endpoint responds unavailable with production or missing feature configuration.
6. Confirm no secrets, raw decrypted content or artifacts enter logs.

## GAIZ metadata staging and reviewer workflow (development only)

New draft migration `packages/db/migrations/0020_gaiz_import_staging.sql` adds `gaiz_import_requests`:
- Tenant-scoped RLS and a matching Drizzle schema table.
- Unique `(tenant_id,sha256)` and `(tenant_id,artifact_id)` constraints for replay/deduplication.
- Requester/reviewer IDs, explicit status and expiry; database CHECK rejects approval by the requester.
- No ciphertext, plaintext, key envelopes or credentials in the table.
- `packages/db/sql/rls.sql` now contains a conditional app-role DELETE revoke for staged requests.

The migration was **committed but not applied**. Do not enable staging until schema migration, RLS and database-role grants are independently validated on an isolated tenant.

Routes behind development-only flags and the existing authenticated tenant middleware:
- `POST /api/v1/gaiz/verify`: verified signature receipt, no storage.
- `POST /api/v1/gaiz/stage`: re-verifies the artifact then creates an idempotent metadata request; requires `pmoa_manage_projects`.
- `GET /api/v1/gaiz/requests`: tenant-only list capped at 50.
- `POST /api/v1/gaiz/requests/:id/review`: distinct signed-in user with `pmoa_admin`, pending and unexpired request only. Approve or reject metadata review, never import data.

Both `GAIZ_PREVIEW_ENABLED=true` and `GAIZ_STAGING_ENABLED=true` are intended **only for disposable local development**, and the code refuses non-development environments. The Next.js `/gaiz` UI is also review-only. A valid staged or approved request always returns `importAllowed:false`.

### Runner-independent checks

```sh
node --test apps/api/src/gaiz/gaiz-verifier.test.mjs \
  apps/api/src/gaiz/gaiz2-verifier.test.mjs \
  apps/api/src/gaiz/gaiz-staging.contract.test.mjs
pnpm --filter @pmo/db typecheck
pnpm --filter @pmo/api typecheck
pnpm --filter @pmo/api build
pnpm --filter @pmo/web build
```

Test with a disposable PostgreSQL tenant after explicitly reviewing and applying the draft migration. The pinned public TO fixture has a synthetic non-UUID tenant ID and **cannot** be used to bypass authenticated UUID tenant isolation. Generate a separate signed fixture for the disposable tenant and provision a disposable Ed25519 public issuer key *out of band*. Verify wrong tenant, duplicate hash, same artifact ID/different hash, self-approval, expired review, simultaneous reviewers, RLS isolation and audit rollback.

### Explicit nonfeatures / blockers

This workflow does **not** implement customer-authorized content decryption, external issuer trust registry, content quarantine, safe business mapping, replay-proof import transactions, long-term retention or artifact recovery. Persistently 'approved' here means a review decision on metadata only. No permission to apply the file follows automatically. Those features require separate changes and security assessment.

## Customer-controlled key custody policy preflight (new)

`gaiz-custody-policy.mjs` is a **pure eligibility checker**, not a key service or API endpoint. `evaluateTebeCustody` requires a consistent authenticated tenant context with `pmoa_admin`, an independently verified matching signature receipt, an approved unexpired staged request made and reviewed by different people, a tenant-scoped active recipient key, and customer consent for any platform-owned recovery recipient. It returns `decryptAllowed:false`, `importAllowed:false`, and `plaintextReleased:false` on success.

The policy module is **not wired to an HTTP route**, does not load private keys, and does not look up authoritative key records. A future integration must query review state from the tenant-scoped database and key/consent records from authenticated registries **on the server**, rather than accepting them from browser JSON. It then needs an external KMS/HSM or customer-held decryption provider that performs independent authorization and emits audit records. Do not pass customer private keys to AI agents.

```sh
node --test apps/api/src/gaiz/gaiz-custody-policy.test.mjs
```

TEBE Actions still cannot be trusted as a passing validation signal until runner execution is restored. The new policy remains draft code, with no database migration applied and no live decryption ability.

## Step 2 — Protected decryption development handoff

TO PR #30 now contains `gaiz/local-custodian.mjs`: a **development-only in-process customer-held RSA private key** decryption proof of concept. It independently re-verifies the exact GAIZ2 artifact, checks active/approved records, requires audit confirmation before decryption, validates the decrypted governance report and returns only a hash and structural counts. It does not return plaintext or authorize imports. It is **not** a true OS sandbox, remote KMS/HSM, trusted tenant service or memory-zeroization guarantee.

TO also defines a domain-separated Ed25519-signed **metadata-only** custody validation receipt in `gaiz/custody-attestation.mjs`. TEBE independently verifies its exact wire contract in `apps/api/src/gaiz/gaiz-custody-attestation.mjs` and denial tests. The receipt ties a particular GAIZ artifact SHA-256, report digest, tenant scope, recipient key and approved review to a five-minute timestamp, using an out-of-band trusted custodian public key.

No TEBE API endpoint accepts this receipt yet. It cannot grant import, decrypt permission or record mutation. Before integrating, independently review key custody, receipt replay protections, signed key identity/rotation and approval authority, then create a durable append-only receipt store and explicit limited-purpose import transaction only after structured data validation.

## Bulk import-readiness hardening

`apps/api/src/gaiz/gaiz-import-plan.mjs` defines a **pure, no-write readiness function**, not a real field-level import preview. It checks an authenticated capability-bearing tenant, an RLS-fetched and separately approved review, the same verified artifact hash/issuer, an authorized tenant-scoped target project and an independently trusted custodian attestation. On success it returns an *empty* `proposedOperations` list with `appliesData:false`, `importAllowed:false` and a mandatory separate mapping/approval requirement.

The function is intentionally **not connected to HTTP or a database mutation**. No decrypted project fields are available to TEBE yet, so claiming a usable project-diff preview would be incorrect. Run `node --test apps/api/src/gaiz/gaiz-import-plan.test.mjs` locally with the other GAIZ unit tests.

Remaining P0: isolated trusted content processing; reviewed project mapping and conflict policy; complete durable import-transaction idempotency; explicit second authorization; integration tests against a disposable RLS database. The existing `0020` staging migration remains **unapplied**.

## Next workstream — internal custody bridge and durable single-use attempt (2026-11-16)

Implemented **development-only, internal application contracts**, not a live custody provider:
- `gaiz-custody-bridge.mjs` orchestrates tenant-scoped authoritative review lookup, cryptographic artifact evidence, approved recipient and custodian trust records, one-use attempt reservation, external attestation verification and durable completion/denial audit.
- `gaiz-custody-handoff.service.ts` binds the contract to TEBE's authenticated tenant context and `pmoa_admin`. Its dependency callbacks must be configured from **trusted server-side** issuer, recipient, consent and custodian systems; there is NO permissive fallback or HTTP controller method.
- `gaiz-custody-attempts.service.ts` implements tenant-RLS review lookup, atomic deduplicated reservation and transactional completion audit; it refuses any non-development deployment or missing `GAIZ_CUSTODY_BRIDGE_ENABLED=true`.
- `0021_gaiz_custody_attempts.sql` is a **new, unapplied** migration. It binds `tenant_id,review_id` to the stage-review parent, enforces one attempt per tenant/review, and stores opaque IDs, hash, status and timestamps only. The app role may update only result-status metadata, never attempt identity or delete it.
- `gaiz-custody-bridge.test.mjs` covers signed receipt success, cross-tenant denial, forged custodian, conflicting key IDs, expired review and replay/audit failure. `gaiz-custody-db.contract.test.mjs` checks SQL/route guardrails, but is NOT a replacement for a real PostgreSQL/RLS integration test.

**Critically, the external provider and persistent trust registry are NOT implemented or connected.** The bridge is registered as a NestJS internal service, but no code calls its validation method through HTTP or on production data. The dependency callbacks cannot be accepted from request JSON. No key, artifact plaintext, file contents or import transaction is handled by this bridge.

The user’s approval to proceed with development does not authorize any live artifact decryption or automatic approval of another user's enterprise import.

Before activation:
1. Run `node --test apps/api/src/gaiz/gaiz-custody-bridge.test.mjs apps/api/src/gaiz/gaiz-custody-db.contract.test.mjs` and the full TEBE build in a disposable checkout; runner remains unverified.
2. Review/apply migrations 0020 then 0021 **only** in isolated test DB and test RLS, concurrent reservations, audit rollback and permission grants.
3. Implement mutually authenticated independent custodian and provision externally verified issuer/recipient/consent registries with key rotation and revocation.
4. Independently review replay domain and receipt time binding, key residency, encryption context and audit failure handling.
5. Keep import apply, project diff and customer release disabled until additional authorization and security gates are satisfied.

## Step 3 — allowlisted project/portfolio field mapping preview (development only)

`gaiz-mapping-preview.mjs` is a **pure no-write component**. It is intentionally NOT connected to an HTTP endpoint, production database query, external custodian, or enterprise import transaction.

It accepts only:
- A validated GAIZ governance report from the **trusted protected content boundary**.
- A separately validated full-report SHA-256 matching the canonical sorted-key report byte format and authenticated tenant scope.
- A tenant-RLS-fetched project or portfolio snapshot, including an expected monotonic revision and exact target identity.
- A separately approved server-side mapping profile specifying one or more explicitly allowed fields.

Current allowlist is deliberately small: `report.title → projects.name` and `report.summary → portfolios.description`. An approved profile must name the exact desired mapping. GAIZ report metrics are **not** interpreted as TEBE project progress, health, budget, approval status, delivery stage, or other business semantics.

The result is a **hash-only preview**: target field, source field, old/proposed SHA-256 hashes, lengths, expected revision, no-op/manual-review flag and a revision-bound preview digest. No report text or old target values are returned; no write operation is created. All changes require a second explicit import approval. To show human-readable text differences, a future protected authorized viewer must be designed and reviewed separately.

Sample local check:

```sh
node --test apps/api/src/gaiz/gaiz-mapping-preview.test.mjs
```

### Critical incomplete dependencies

1. The existing TEBE project and portfolio schema **does not contain a monotonic revision column** for this purpose. The snapshot revision is a required interface contract, not a working live DB integration. Design the revision strategy and concurrency controls before enabling.
2. The current TO local custodian returns only hashes/counts, never plaintext. The mapping module therefore has **no real decrypted report input**; do not bypass the boundary by accepting decrypted content from browser JSON. Use only trusted in-boundary content in a future isolated workflow.
3. Mapping profile approval records and their tenant-scoped durable storage **do not exist**. The `approved:true` field is a contract assertion and must come from an authoritative registry, not user input.
4. This is **not** a complete business-data import preview. It intentionally does not map program/portfolio relationships, statuses, budgets, risks, stage gates or audit events, and does not apply updates.
5. On commit, a future separate transaction must re-read the exact tenant/snapshot revision, require independent review, maintain idempotency and append an audit event or roll back. No such commit path exists.
6. TEBE's hosted CI is currently unavailable; unit tests are committed but their successful execution is not established.

## Step 4 — second-person import authorization and conflict safety (draft)

`gaiz-import-authorization.mjs` defines a pure, **no-write** preflight for the exact tenant, previously approved staging review, completed custody validation, hash-only field preview, second-person import decision and **fresh target snapshot fingerprint**. It refuses stale revisions or changed target fields, expired approvals, cross-tenant objects and approval by the original stage requester or import-review requester. A successful result still has `appliesData:false`, `importAllowed:false` and no operations.

`gaiz-import-authorization.service.ts` is a **development-only metadata decision ledger** using tenant-scoped transactions, an atomic pending-to-reviewed transition and same-transaction audit records. It refuses import-review self-approval and approval by the original staging requester. It creates neither project nor portfolio changes. **Important:** the service currently accepts hashes as caller-provided metadata; these are *not authoritative proof* that a protected custodian or database snapshot was verified. The pure preflight and durable review ledger are not yet connected into a write-capable authorization process.

Draft **unapplied** `0022_gaiz_import_authorizations.sql` binds a second review to the same tenant’s staged request and custodian attempt, stores immutable target identifier and hashes, permits one approval request per staging review, and enforces tenant RLS plus dual-person state checks. The app DB role can update only decision state and reviewer metadata, not hashes/target/requester. A separate PostgreSQL integration review must verify all grants, composite foreign keys and lock/concurrency semantics.

The existing project and portfolio tables do **not** yet expose the monotonically incremented revision used by the preview. Nor is there a production protected content handoff, approved mapping profile registry, authorized human-readable diff or transactional record apply pathway. Never invoke these draft checks using plain browser-provided snapshots or trusted-status flags. No import API route is exposed.

Local test commands (full execution not yet independently verified):
```sh
node --test apps/api/src/gaiz/gaiz-import-authorization.test.mjs \
  apps/api/src/gaiz/gaiz-import-authorization.contract.test.mjs
```

Production release gates remain: isolated test DB migrations 0020–0022, tenant RLS and race testing, authoritative target snapshot/revision checks, KMS/HSM and recipient custody, second-person security review, rollback and audit consistency, and full application build. A successful test of no-write functions does **not** constitute safe permission to merge or import enterprise data.
