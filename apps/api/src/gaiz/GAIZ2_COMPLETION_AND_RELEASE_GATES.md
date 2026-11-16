# GAIZ2 — Development completion and release gates

Work rule: proceed with safe development without waiting for pending GitHub CI. Skipped and failed tests are NOT release approvals. Draft PRs are not to be deployed.

## Components implemented in development branches

- TO: signed GAIZ2 encryption, key policy, offline synthetic decryption prototype, disposable subprocess, schema quarantine and signed metadata attestation.
- TEBE: tenant-bound verifier, metadata staging and dual review, single-use custody attempts, read-only signed custody receipt checks, hash-only project/portfolio mapping, revision-aware target snapshots and separate import-review decisions.
- TEFE: read-only browser GAIZ2 inspection and synthetic preview.
- Migration 0024 adds tenant-RLS mapping profiles, exact allowed paths, separate approval and immutable path grants.
- Migration 0025 binds import decisions to the exact tenant/kind mapping profile.
- TO mapping-attestation signer and independent TEBE mapping-attestation verifier bind tenant, staging review, report/artifact digests, custodian, target, revision, profile and expiry.
- TEBE import-review requests require an approved server-authoritative mapping profile and trusted signed metadata receipt rather than accepting only a claimed preview hash.
- TEBE transaction-locked commit readiness rechecks approved stage, validated custody, exact profile and current target revision. This is inspection only; locks end with transaction, and no enterprise changes are made.
- Disposable synthetic PostgreSQL test harness covers migrations 0020 through 0025 and includes tenant RLS, role permissions and concurrency checks. These tests are deferred at the user's request, not accepted as passing.

## Production functions not yet deliverable safely

1. Real separately authenticated customer-held or KMS/HSM custodian and reliable key rotation/revocation. Local subprocess is not hardened isolation.
2. Trusted persistent tenant-level issuer, recipient, custodian and customer-consent registries. No browser-provided trust anchors.
3. Protected human-readable diff and authorized customer review without releasing report plaintext into untrusted browsers, AI prompts or logs.
4. A write-capable import executor. An import requires same-transaction approval rechecks, SELECT FOR UPDATE, revision-based compare-and-swap, one-time commit authorization, exact approved field hash, approved allowlist and audit event with atomic rollback.
5. Real full application build and PostgreSQL/RLS/concurrency/regression tests, independently validated cryptography and customer-security acceptance.
6. Approved controlled staging migration and production release. Draft migrations 0020–0025 have not been applied.

## Recommended eventual import transaction (NOT implemented)

- Begin an authenticated tenant-scoped DB transaction.
- Lock the target and import decision, verify two independent human approvals, current trusted key/issuer/consent and a fresh signed custody mapping receipt.
- Check target revision and field fingerprint match the approved preview; reject conflicts, expired evidence, cross-tenant data and replay.
- Allow only explicit supported fields; never infer progress, budget, status, health, risk or governance decisions from generic metrics.
- Atomically mark a one-use import authorization consumed, update using tenant + ID + expected revision as CAS, and append a tenant-scoped immutable audit event.
- Commit only if every step succeeds; otherwise roll back all updates and consumption records.

Never treat a read-only readiness receipt as permission to update records in a later transaction.

## Status

Development interfaces and no-write integration are committed. Neither cryptographic custody production integration nor approved enterprise writes are live. GitHub test tasks were not awaited or used as approval. No customer data, keys, production migrations, merges or deployment performed.
