# GAIZ v1 delivery plan — implementation checkpoint

**Date:** 2026-11-16
**Status:** Engineering foundation developed in review branches. **NO-GO** for
production. This is a truthful status record, not test acceptance or approval.

## Cross-repository ownership and current deliverables

| Repository | PR | Scope | Current delivery |
|---|---|---|---|
| `faisalwrokksa-hub/TO` | [#26](https://github.com/faisalwrokksa-hub/TO/pull/26) | Format, encryption and local producer | Architectural proposal and candidate `gaiz/core.mjs`, but canonical GAIZ v1 signed payload/wrapping contract NOT frozen |
| `2029TEBE/TEBE` | [#507](https://github.com/2029TEBE/TEBE/pull/507) | Authenticated tenant workflow, import, approvals, RLS and audit | Unregistered verifier/assignment/claim policy and draft import designs. None deployed |
| `2029TEFE/TEFE` | [#41](https://github.com/2029TEFE/TEFE/pull/41) | Public GAIZ documentation and marketing boundaries | Design-only, no misleading live upload/checkout/vault claims |

## Implemented in TEBE draft branch (not operational)

1. Authenticated tenant/server capability contracts and inactive NestJS
   integration seams; production hard-disable is in place.
2. Bounded quarantine metadata and candidate private ciphertext persistence,
   immutable issuer evidence and strict inert draft mapping.
3. Human approval decisions with separate submitter/approver rules,
   serialized job revisions and a review-only draft-import executor.
4. Proposed tenant-composite foreign keys, FORCE RLS and column grants.
   The proposal has eight GAIZ tables including the single-use worker claim
   ledger. No migration has been executed.
5. Signed Ed25519 worker assignment verification, purpose/expiry bounds,
   conditional workload binding and a disconnected one-time claim helper.
6. `gaiz-worker-transaction.ts`: an inactive composition seam placing
   tenant transaction scope, assignment claim and trusted operation callback
   under **one transaction**. Not an actual trusted worker or API route.
7. Synthetic TO-produced fixture and offline/opt-in acceptance source are
   present, but do NOT constitute deployed interoperability proof.

## Remaining engineering actions (not simply CI tasks)

1. **TO protocol owner:** freeze signed bytes, canonical JSON, versioned
   governance-report payload, issuer trust anchor, key rotation/revocation,
   AES-GCM AAD and secure recipient key wrapping. Sign off sample vectors.
2. **Security/infra:** provision independently authenticated verifier/executor
   workloads and separate **non-owner**, non-superuser, non-BYPASSRLS database
   credentials. Integrate mTLS/workload trust; reject any caller-provided
   identity flags as authorization.
3. **Database:** reconcile the additive design with real table definitions,
   baseline RLS, existing roles/default grants and transaction isolation.
   Apply only through a reviewed migration on disposable infra first.
4. **Verifier:** implement trusted tenant issuer lookup, immutable quarantine
   byte retrieval/digest check, verified Ed25519 and AES-GCM decryption,
   zero-secret persistence, mapping provenance and atomic state changes.
5. **Executor:** use the separate worker DB identity and lock all relevant
   rows. Combine one-time assignment claim, independent human approval,
   fresh mapping, document draft, receipt, audit and state CAS in one commit.
6. **Data lifecycle:** implement authorized expiry cleanup, security event
   logging, backup retention and compromised issuer/credential revocation.
7. **TEFE:** ship truthful localized public content only after authoritative
   service endpoints exist; no customer private data or keys in public assets.

## Deferred validation (never classified as passed)

The requester asked to skip pending GitHub testing tasks for the time being.
Work may continue on draft branches, but the following remain **release gates**:
TO/TEBE conformance, Node/Nest build/type checks, PostgreSQL tenant/RLS
and concurrency acceptance, key custody assessment, authenticated API/UI
acceptance, security review and GitHub CI green on the exact reviewed SHA.

CI is independently blocked: a minimal `ubuntu-latest` runner probe,
https://github.com/2029TEBE/TEBE/actions/runs/43875757063,
failed before any steps were recorded. Only the account owner or GitHub
Support can confirm billing/policy/runner startup restrictions.

## Non-negotiable activation boundary

- **Do not** wire the draft worker transaction module into AppModule,
  issue live credentials, migrate production or expose imports/exports now.
- Do not merge merely because tests were skipped or use automatic approval
  to replace the independent human import approver or security reviewer.
- No email service, background scheduler or new paid infrastructure is needed
  to retain this draft work.
- After all blockers are independently cleared, prepare a separately reviewed
  minimal deployment with explicit rollback, observability and tenant opt-in.


## Subsequent worker boundary hardening

- The unregistered `gaiz-worker-transaction.ts` coordinator now accepts
  **signed assignment bytes**, a backend-owned trusted issuer public key and
  independently attested workload identity; it invokes
  `bindGaizWorkerIdentity` itself rather than accepting a caller-created
  object bearing `authenticatedAssignment:true`.
- Added strict TypeScript declarations for the existing `.mjs` binding
  seam and static regression tests for signed validation, claim ordering,
  transaction-local tenant context and production-disable.
- Three new source-level assertions passed using a V8 source harness.
  Actual Node/Nest TypeScript build and Postgres acceptance are still pending,
  and the new type declaration has not been checked by the official compiler.
- This reduces one accidental bypass path but **does not authenticate mTLS**
  on its own; the workload identity and issuer key MUST still originate from
  independent trusted runtime configuration.


## Synthetic key-custody integration checkpoint (not production)

- Added `gaiz-key-custody-candidate.mjs`, a deliberately inactive,
  **development-only** async custody provider boundary for synthetic
  GAIZ1 report previews. It checks authenticated preview capability,
  backend issuer trust, signed artifact identity and tenant scope
  **before** calling the custody provider. The provider receives only
  frozen tenant/artifact/digest/key ID and the restrictive
  `synthetic-preview-only` purpose.
- The adapter never persists, logs or returns a DEK; it copies the
  custodian-owned 32-byte key and clears its local copy in `finally`.
  The public issuer key lookup remains subject to revocation and
  validity-window checks. Preview returns only inert title/summary and
  `authorizedToImport:false`.
- A synthetic TO-produced fixture drives negative cases for wrong DEK,
  mismatched tenant, untrusted/revoked issuer, insufficient entitlement,
  ciphertext tampering and invalid custody output. Tests are wired into
  deferred offline CI, not marked passed.
- **No recipient-bound key wrapping yet exists in the current candidate
  format**; this provider is not KMS integration and cannot be promoted to
  production. TO must define recipient envelope/wrapping/AAD and rotations;
  infrastructure must provide real HSM/KMS or equivalent custody,
  authenticated work identities, key-use audit and revocation.


## GAIZ2 signed recipient consumer correction

The TO protocol owner has already implemented **experimental GAIZ2** in
[faisalwrokksa-hub/TO#30](https://github.com/faisalwrokksa-hub/TO/pull/30).
Its RSA-OAEP-SHA256 recipient wraps are **inside** the Ed25519-signed
envelope; this is a safer format boundary than detached unsigned wraps.
TEBE now has a separate metadata-only GAIZ2 signature verifier, with
synthetic negative tests and an explicit draft consumer contract:
`docs/gaiz/GAIZ2_TO_TEBE_CONSUMER_CONTRACT.md`.

The GAIZ1 synthetic custody adapter remains **GAIZ1-only**, inactive and
incompatible with GAIZ2; do not reuse its 32-byte caller-supplied key path
for RSA-OAEP recipient envelopes. TEBE must not open or import GAIZ2
until trusted issuer policy, recipient custody, payload schema and
approval/workflow contracts are reviewed. The source-parsing checks are
not equivalent to executed Node or PostgreSQL conformance tests.
