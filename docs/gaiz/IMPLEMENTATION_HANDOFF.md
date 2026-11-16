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
- Bounded quarantine metadata preparation and same-key/different-hash rejection
  in `apps/api/src/gaiz/gaiz-intake.mjs`, without storing uploaded bytes.
  A future storage adapter must atomically persist a private ciphertext object
  and bind `idempotency_request_sha256` to the stored job, then verify actual
  object digest at consumption. No remote reference fetches (SSRF) are enabled.
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

## Latest safe implementation checkpoint
- Bounded quarantine preparation via `gaiz-intake.mjs` records only a SHA-256
  and non-sensitive metadata; no object storage, upload route, preview rights
  or database write is activated.
- Idempotency collisions with a reused key but different artifact digest are
  rejected; the database adapter must atomically enforce this during intake.
- Draft tenant RLS policy review is in `docs/gaiz/PROPOSED_RLS_REVIEW.sql`;
  **not applied**, and requires comparison to the auto-generated RLS script.
- Draft approval adapter now revalidates the actual signed-in tenant, actor
  and `pmoa_approve` capability even if called outside the orchestrator.


## Durable quarantine and mapping draft (unregistered)
- `apps/api/src/gaiz/gaiz-quarantine-postgres.ts` drafts a transactionally
  committed, tenant-scoped ciphertext-byte quarantine: it validates bounds,
  copies the input bytes before hashing, serializes concurrent tenant claims,
  revalidates membership, enforces per-tenant count/byte quotas, compares
  repeated idempotency keys against actor/hash/size, and writes an audit event
  only for the first insert in the same transaction.
- It requires `GAIZ_DEV_ONLY=true` and refuses production even then. It is
  NOT registered with AppModule or any accessible controller. Its proposed
  table and ciphertext column read restrictions require independent DB review.
- The proposal includes 24-hour expiry, but secure retention/expiry deletion
  and backup removal are NOT implemented. No signed-content verification is
  inferred from successful quarantine storage.
- `apps/api/src/gaiz/gaiz-draft-mapping.mjs` restricts a synthetic governance
  report to inert `title` and `summary` proposal fields with provenance,
  enforcing same-tenant evidence and rejecting HTML, arbitrary keys and
  unsupported versions. It cannot create records or approve imports.
- `docs/gaiz/DISPOSABLE_QUARANTINE_ACCEPTANCE.md` is the execution matrix.
  The tests in that matrix and any real PostgreSQL integration have NOT run.
- The published API remains inactive; quarantined files cannot be submitted
  through HTTP. The entire plan remains contingent on TO format decisions,
  correct key custody, RLS, producer fixtures and security review.

## Draft document import executor (unregistered; review candidate)
- `apps/api/src/gaiz/gaiz-draft-import.executor.ts` prepares an **inactive**
  approval-controlled transaction using the existing TEBE `documents` model:
  it inserts only a `draft` governance report document, with no URL or
  privileged gate/project mutation.
- Under `withTenant`, it rechecks active membership and a manage-projects
  capability, locks the approved import job, checks independent issuer and AEAD
  evidence, source/quarantine/mapping hashes, expiry, a distinct approving
  person, a persisted approval decision, and the exact validated mapping
  timestamp before inserting document, receipt and audit atomically.
- Approval is valid for at most 15 minutes at execution. Concurrent attempts
  serialize on the same row; receipt uniqueness is proposed in the schema.
  Idempotent retries return the existing receipt only if the job is `imported`.
- `gaiz_import_proposals` and `gaiz_import_receipts` are **proposed schema
  only**. The producer of trusted mapping rows is not implemented. The app
  role must not be allowed to forge `validated_at`, source digest or signature
  evidence; dedicated worker grants and immutable row controls require review.
- This executor is intentionally **not injected or registered in AppModule**.
  No production or test database migration was applied, and no PostgreSQL
  concurrency/rollback or TO fixture acceptance was executed.
- `apps/api/src/gaiz/gaiz-draft-import.static.test.mjs` contains source-level
  guard tests; it does not replace integration or authorization tests.

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
node --test apps/api/src/gaiz/gaiz-intake.test.mjs
node --test apps/api/src/gaiz/gaiz-draft-mapping.test.mjs
node --test apps/api/src/gaiz/gaiz-draft-import.static.test.mjs
pnpm build:packages
pnpm typecheck
pnpm test
pnpm verify:rls
```
These commands are **prescribed**, not evidence they have passed. GitHub
Actions failures remain unresolved; do not merge or deploy.
