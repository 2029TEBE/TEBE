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

## Trusted public-key directory foundation (additional development increment)

New draft migration `0026_gaiz_trust_directory.sql` introduces tenant-RLS issuer/custodian/recipient public key records with algorithms, fingerprints, validity windows, independent reviewer and irrevocable revoked status metadata. A separate tenant-RLS recovery consent record binds a specific platform recipient, purpose, expiry, separate approval and revocation. Neither table contains a private key, customer report content, ciphertext or a data-encryption key.

The app database role has **SELECT only** on both tables. Key enrollment, revocation, signer proof-of-possession and consent provisioning must occur through a separately authorized administrative path; no such mutation endpoint has been implemented. This prevents a compromised normal application API from enrolling its own trust root using ordinary role privileges, but does not defend against a compromised database owner or privileged migration path.

`GaizTrustDirectoryService` is internal, read-only, development-flagged, authenticated and tenant-scoped. It fails closed for pending/revoked/expired keys, invalid or mismatched public key fingerprints, unsupported RSA key sizes, missing independent approval and absent/expired/revoked platform recovery consent records. Custodian and issuer signers must use Ed25519, recipients RSA-3072+ OAEP-SHA256. `GaizCustodyHandoffService` now obtains recipient and custodian trust from this server-owned registry rather than accepting public trust roots from externally injected callbacks. The existing artifact verifier and remote custodian response callbacks still require a trusted implementation.

**Limits that cannot be waived:** A row marked approved in the consent ledger does not itself cryptographically prove the approving user is an authorized customer representative. Membership, customer authority, consent signatures, trust-key enrollment, proof-of-possession, mutual TLS/service identity, customer-managed key custody, remote attestation, KMS/HSM provisioning and production audit must be independently designed and verified. Do not set the new registry or bridge feature flags in production. Neither public-key metadata nor a signed validation receipt gives permission to decrypt or import enterprise records.

New source-level negative/security contract `gaiz-trust-directory.contract.test.mjs` is included for later automated execution. PostgreSQL harness now includes migration 0026; user has requested not to wait for pending GitHub test jobs. **No current CI pass is claimed**, and all 0020–0026 migrations remain unapplied.

## Trusted runtime engineering continuation

The separate trusted-runtime PR now implements the grant/result protocol,
Vault-backed non-exportable key operations, TEBE-owned public registry adapter,
independent approved-field digest verification, and same-transaction CAS/import
consumption/audit executor. It repairs the malformed unapplied 0022 migration,
adds 0027 execution ledger/tenant-bound read locks, and includes NestJS internal
composition plus ESM build packaging. See `runtime/PROTOCOL.md` and
`tests/gaiz-runtime/README.md` for the exact boundary and reproducible acceptance.
The older statement that no executor code exists describes the prior checkpoint.
No runtime is configured or enabled and no existing database migration is applied.
Live workload identities, audited customer authority, hardened isolation, full app
build, real multi-connection PostgreSQL acceptance, external security review and
release approval remain operational gates; GitHub CI remains postponed.
## GAIZ remote custodian mTLS transport — development adapter

`apps/api/src/gaiz/gaiz-custodian-mtls.mjs` now exposes `makeCustodianMtlsTransport`, which requires an **explicit server-owned** HTTPS endpoint, pinned remote server SPKI SHA-256, trusted CA, and a distinct client TLS certificate/private key. This TLS client identity key is **not** a customer's GAIZ2 artifact-decryption key. It enforces TLS 1.3 minimum, rejects URLs with embedded credentials, arbitrary paths, URLs with query/fragment, non-443 ports, localhost and literal IP addresses; refuses redirects; imposes a five-second deadline and an 8 KiB JSON response limit. Outbound body contains the approved custody request metadata only. It never sends a GAIZ artifact, private key, wrapped DEK, or decrypted report.

`GaizCustodyHandoffService` now creates this mTLS transport rather than accepting an arbitrary `requestAttestation` callback. The independently trusted Ed25519 public custodian key is **still loaded from the tenant trust directory**. The existing custody bridge cryptographically verifies the returned signed validation receipt and performs its single-use attempt reservation and transactional audit.

This adapter is gated to `NODE_ENV=development` and `GAIZ_REMOTE_CUSTODY_TEST=true`. No endpoint, PKI trust chain, client certificate, server certificate pin or external provider has been provisioned or tested live. It is **not production ready**. The TLS client key must live in a separately managed service identity store, not in source code, repo secrets, HTTP bodies, browser state or prompts. Trust-root rotation, endpoint DNS ownership, real client-cert authorization, external request authentication, customer-key custody, key revocation and remote provider incident handling all remain necessary.

Do not weaken TLS or remove the pinned server public-key check to obtain a passing demo. The development-only mTLS test suite checks rejection of invalid endpoints/credentials and default-off behavior but does not constitute successful remote provider interoperability. No import permissions or customer decrypt endpoints were enabled.
