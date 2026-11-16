# TEBE GAIZ v1 — Enterprise foundation handoff

Status: **experimental foundation, not deployable**. All new code remains on
`feat/gaiz-enterprise-foundation-20261116`; production untouched.

## Existing enterprise boundaries
- `apps/api/src/tenancy/tenant.middleware.ts` authenticates session and derives
  tenant/user/capabilities server-side.
- `apps/api/src/common/require-capability.ts` enforces capabilities.
- `apps/api/src/platform/module.guard.ts` enforces tenant subscription.
- `packages/db/src/client.ts` provides transaction-scoped RLS tenant context.
- `apps/api/src/audit/audit.service.ts` writes audit in the same transaction.

## Included in this branch
- Independent issuer trust-policy candidate and revocation tests in
  `apps/api/src/gaiz/gaiz-trust.mjs`; issuer key ID is backend-selected,
  not parsed from an untrusted artifact. This registry is not yet wired to key custody.
- Synthetic, inert JSON-only AES-GCM preview adapter in
  `apps/api/src/gaiz/gaiz-synthetic-preview.mjs`; not exposed by an API.
- Localized, inactive entry page at `apps/web/src/app/(app)/gaiz/page.tsx`.
- Strict Zod metadata contracts in `packages/contracts/src/gaiz.ts`.
- Pure, deny-by-default workflow transitions and replay namespacing in
  `apps/api/src/gaiz/gaiz-workflow.mjs`; negative tests included.
- An unregistered controller/module containing the proposed six versioned endpoints.
- A metadata-only PostgreSQL adapter that reads jobs under `withTenant` and
  records an authorized pre-validated human decision using `FOR UPDATE`,
  revision checks and same-transaction audit. This adapter is **not injected**;
  upload/import/export processing still deliberately refuses operation.
- A NestJS orchestrator **not registered with AppModule**. Even explicit
  `GAIZ_DEV_ONLY=true` cannot activate production processing; it rejects
  unless injected with an independently reviewed enterprise adapter.
- A design-only additive SQL schema in this docs folder, not the migration
  ledger. Schema references must be reconciled with actual DB objects first.

## Proposed HTTP contract (NOT ACTIVE)
POST /api/v1/gaiz/imports
GET /api/v1/gaiz/imports/:id
POST /api/v1/gaiz/imports/:id/approve
POST /api/v1/gaiz/imports/:id/reject
POST /api/v1/gaiz/exports
GET /api/v1/gaiz/exports/:id

Strict schemas are importSubmission/decision/exportSubmission in contracts.
Do not expose controller routes before: reviewed TO v1 wire contract and
test fixtures; trusted issuer registry and rotation policy; bound DEK envelope;
AEAD-verified decrypted structured payload; malware/quarantine flow;
approved mapping to DRAFT records; durable CAS + replay uniqueness; approved
tenant RLS migration; transactional audit; object-level authorization and
negative/positive disposable tenant acceptance.

## Security-critical persistence requirements
- Atomically claim unique tenant+issuer+artifact and idempotency key.
- Never use in-memory mutexes as concurrency or replay defense.
- Lock job row FOR UPDATE; check revision/tenant and actor permission in same
  transaction as state transition, draft creation and audit receipt.
- Caller must not be able to forge verification flags; derive evidence from
  independently validated, server-stored, immutable artifact state.
- Import state now includes a separate `approved` state; approval does not
  itself create records or trigger execution.
- Human approval must be rechecked for actor, operation, membership, version
  and expiry immediately before importing. A mere boolean is insufficient.
- Do not store uploaded plaintext, signing/private keys or DEKs in audit logs.
- No endpoint or UI should claim a signed envelope is decrypted, content-safe
  or authorized merely because Ed25519 signature verification succeeded.

## TO handoff
- Freeze exact UTF-8, key order, numeric JSON and duplicate-key semantics;
  signature byte sequence, AAD, key-wrapping and rotation, issuer identity,
  critical fields, algorithm version/downgrade rules and real fixture vectors.
- Provide synthetic positive, wrong-key, wrong-tenant, tampered, replay and
  unsupported-version fixtures with expected outcomes.

## TEFE handoff
- Do not put keys, tokens, signed capabilities or plaintext in public website.
- Only link to the authenticated TEBE experience once approved.

## Independent commands (when checkout and Node 22 available)
```sh
node --test apps/api/src/gaiz/gaiz-verifier.test.mjs
node --test apps/api/src/gaiz/gaiz-workflow.test.mjs
node --test apps/api/src/gaiz/gaiz-synthetic-preview.test.mjs
node --test apps/api/src/gaiz/gaiz-trust.test.mjs
pnpm build:packages
pnpm typecheck
pnpm test
pnpm verify:rls
```
These commands are **prescribed**, not evidence they have passed. GitHub
Actions failures remain unresolved; do not merge or deploy.
