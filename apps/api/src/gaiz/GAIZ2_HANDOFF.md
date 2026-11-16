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
