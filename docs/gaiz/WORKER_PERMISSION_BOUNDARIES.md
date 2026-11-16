# GAIZ service identity and permission boundary — design review

**Status: proposal only. Not installed, not activated, not an approval.**
Reconcile with `packages/db/sql/rls.sql` and production role grants before any
disposable deployment. This document must never be executed as SQL.

## Roles and responsibilities

| Principal | Allowed | Explicitly forbidden |
|---|---|---|
| `pmo_app` (interactive API) | Authenticated tenant-scoped metadata reads; submit quarantine bytes through a scoped intake mechanism; request approval decision through approved transaction API | Read raw ciphertext; INSERT/UPDATE trusted artifact or mapping evidence; directly create import receipts; switch to verifier/executor identities |
| `gaiz_verify_worker` (future isolated service) | Read quarantined ciphertext under an authenticated tenant/work item claim; record only verified artifacts and immutable validated proposals | Approve customer imports, write business documents, issue execution receipts, access other tenants |
| `gaiz_execute_worker` (future isolated service) | Execute a single approved import as a tenant-bound, short-lived work item with atomic audit and draft document creation | Forge issuer signature / AEAD evidence; create human approvals; rewrap or release DEKs; change gates/projects to approved |

The RLS proposal now denies direct `pmo_app` writes to import jobs,
approval decisions and export jobs as well as trusted artifacts, mappings
and receipts. The unregistered adapter's decision method consequently cannot
operate under the ordinary app role. This is intentional: it must be replaced
with an independently reviewed, restricted server-side transaction boundary.

The two worker principals are **not currently implemented or deployed**.
They must have independently issued, short-lived credentials and be unable to
`SET ROLE` into each other. Never `GRANT gaiz_verify_worker TO pmo_app` or
`GRANT gaiz_execute_worker TO pmo_app`. Do not use elevated
`SECURITY DEFINER` handlers without a separate, reviewed threat model.

## Inert worker-handoff policy

`apps/api/src/gaiz/gaiz-worker-handoff.mjs` adds two pure,
fail-closed policy checks. It has no NestJS injection, database access,
key custody, command execution or HTTP routes:

- `authorizeGaizVerifyHandoff` requires a declared verifier principal,
  exact matching tenant and quarantine work-item identifiers, verified
  signature + authenticated payload evidence, matching SHA-256 and the
  `quarantined` revision. It only produces `importAllowed=false`.
- `authorizeGaizExecuteHandoff` requires an independently approved job,
  separately identified requester, approver and executor, exact revision,
  unexpired approval, matching artifact/quarantine/mapping hashes and
  affirmative replay-claim evidence. Its output is a **draft-only**
  transaction plan requiring an atomic receipt.
- Both functions reject extra fields. Their inputs are assumed to be
  **trusted backend evidence**, not values received over HTTP or read
  from an untrusted GAIZ envelope. These checks do not prove a worker
  principal is authentic or that evidence is immutable.
- The policy is not connected to `GaizPostgresAdapter` or
  `GaizDraftImportExecutor`, because their existing `withTenant`
  execution uses the interactive app database role. That role has been
  explicitly denied verification/evidence and receipt write privileges.
  Wiring it directly would silently contradict the least-privilege design.

`gaiz-worker-handoff.test.mjs` covers wrong role, mismatched tenant,
altered digest, stale/replayed approvals, tampered provenance and
insufficient verification. A local V8 compatibility harness passed
four test cases against fetched source using a test shim for
`timingSafeEqual`; the actual Node crypto and PostgreSQL tests remain
unverified until run in an isolated checkout/CI.

## Candidate signed work assignment verification (unregistered)

`gaiz-worker-assignment.mjs` verifies a short-lived Ed25519-signed
`GAIZ_WORKER_ASSIGNMENT_V1` assignment against a **server-configured**
issuer public key. It binds a UUID worker, tenant, work item, single
verifier/executor purpose, issued/expiry timestamps and assignment ID.
It rejects noncanonical envelopes, duplicate JSON keys, altered
signatures, missing/incorrect identities, wrong purpose, long TTL
(above two minutes) and expired assignments. Its private signing keys
are **not** stored or created by the application.

**Crucial distinction:** the signed claim authenticates an *assignment*,
not the process making the request. A worker transport credential
(mTLS or comparable dedicated workload identity) must be independently
authenticated and its identity matched to the signed workerId.
Furthermore, `assignmentId` MUST be transactionally claimed just once
by the correct tenant and worker in PostgreSQL before any
verification/import action is committed. Otherwise a stolen, still-valid
assignment could be replayed. The proposed `gaiz_worker_assignment_claims`
table and disconnected `gaiz-assignment-claim.ts` transaction seam now model
this atomic claim, but **no actual database table, worker role, or workload
authentication is deployed**. The single-use guarantee has NOT been verified
against live PostgreSQL.

The resulting object sets `importAllowed:false` and
`databaseClaimRequired:true`. It does not connect to the
`gaiz-worker-handoff.mjs` policy or to database adapters; do not treat
the result as an authorization to write a document. The tests use
synthetic keys and no production credentials.

## Single-use claim transaction design (inactive)

The review-only schema proposes a globally unique `assignment_id` primary
key, bound to tenant, worker, work item, purpose and expiry. Each worker must
call `claimGaizWorkerAssignmentInTransaction(tx, assignment, identity)`
inside the **same database transaction** as its actual verification or draft
import, after independent credential and assignment checks. The function:

- Requires `GAIZ_DEV_ONLY=true` and refuses production.
- Checks the connected PostgreSQL `current_user` exactly equals the assigned
  verifier/executor role and the active `app.tenant_id` matches the signed
  assignment.
- Uses the PostgreSQL clock to enforce expiry; conflicting assignment IDs
  return zero rows and fail, including cross-tenant retries.
- Returns only an inert `claimAcquired:true` receipt. The calling worker
  must perform remaining state/revision, provenance, membership, signature,
  AEAD and audit checks in the **same transaction before commit**.

**Do not call this claim method in an independent transaction**: committing a
claim without the associated effect can permanently consume an assignment,
and a rollback must release it for an authorized retry. The helper does not
establish the authenticity of its two input objects. Its trust boundary still
requires a verified workload transport, private database credentials, immutable
signed assignments and a reviewed worker runtime.

## Signed assignment to workload identity binding (candidate only)

`apps/api/src/gaiz/gaiz-workload-binding.mjs` now binds an independently
authenticated workload identity to an Ed25519-verified short-lived assignment.
It enforces exact worker UUID, purpose, tenant and work item, workload
credential expiration, and assignment issuer verification. It returns an
inert, frozen receipt with `importAllowed:false` and
`databaseClaimRequired:true`. Offline negative tests cover identity,
role, scope, issuer and expiry mismatch.

**Integration limitation:** the code has no mTLS termination, workload
certificate verification, credential revocation lookup, or deployed identity
provider. Its `workload` argument MUST be created only by a trusted ingress
after authenticating the service, never from HTTP headers, queue JSON or
signed artifact metadata. An object field such as `credentialIssuer`
does NOT independently authenticate a workload. The binding does not
activate the GAIZ API, create database privileges or claim an assignment.
The claim must still be made atomically with the actual worker effect.

## Minimum controls before introducing workers

1. Every database transaction sets `app.tenant_id` from an **authenticated,
   server-controlled** claim, never from a document manifest, HTTP parameter,
   message queue body or client-supplied request.
2. RLS must be **FORCE**d for all eight GAIZ tables. Work roles must not be
   table owners, superusers or have `BYPASSRLS`.
3. The tenant's issuer allow-list and key revocation state must be selected by
   the verifier from backend-owned immutable policy, not from artifact fields.
4. Verified artifact rows and validated proposal rows are *append-only* to the
   verifier role; the interactive application role cannot INSERT or UPDATE them.
   Trusted timestamps must be server generated.
5. Only the executor may create `gaiz_import_receipts`. Receipt and business
   document insertion, job state change, audit entry and replay claim are
   **one transaction**. The executor needs narrowly scoped privilege over the
   existing `documents` and `audit_events` tables.
6. Human approval is a separate user action with authenticated approver identity,
   tenant membership and `pmoa_approve`, never an artifact flag. Store approval
   against the immutable mapping fingerprint and revision.
7. Verify the **exact** quarantine bytes via a stored SHA-256 and AES-GCM tag
   before persisting mapping data. One signature verification is insufficient.
8. Rotation, DEK wrapping/unwrapping, per-tenant quotas, retention and
   expired-work-item recovery all require separately reviewed design and tests.
9. Re-run the established RLS script after schema/roles installation in the
   disposable environment to identify broad GRANT regressions. Review role
   membership chains and column grants, not just direct table privileges.
10. Quarantine exception paths must not mark a job `verified` or `approved`.

## Explicit release gates

No automatic approval, merge or production deployment can proceed until all
of the following have machine-verifiable evidence plus human security signoff:

- TO producer conformance with genuine emitted fixtures (including negative
  cases), a frozen canonical signed payload schema and reviewed key wrapping.
- Two-tenant disposable PostgreSQL tests with concurrent same-key and
  different-key submissions, fail/rollback, replay and cross-tenant writes.
- A verifier role that **cannot execute** and an executor role that **cannot
  forge evidence**, with effective grants/role membership independently tested.
- End-to-end authenticated API and UI tests, logging/privacy review, quarantine
  retention cleanup, emergency revocation and rate limits.
- Successful full TypeScript/build/test/CI on the exact reviewed commit.

Routine checks can be scheduled or run automatically. A check passing does
not mean a human import approval, security approval or release was issued.
