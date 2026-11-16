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
