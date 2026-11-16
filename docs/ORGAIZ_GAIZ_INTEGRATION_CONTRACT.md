# Orgaiz and GAIZ Shield — TEBE enterprise contract

Status: design-only, NOT IMPLEMENTED. Updated 2026-11-16.

## Boundaries
Orgaiz is the public brand. THEEPMO remains the authenticated governance, project and portfolio system. TEBE remains the authority for identity, tenant membership, roles, entitlement, audit and PostgreSQL RLS. The proposed .gaiz encrypted artifact is an exchange container, NOT a replacement for enterprise records or database permissions.

TO proposes the canonical format, cryptographic library and test vectors. TEBE must pin/verify the reviewed format version before enabling any runtime integration. TEFE is public marketing and does not control file keys or tenant authorization.

## Future safe import flow
1. Authenticate the existing enterprise user and resolve tenant/workspace on the server.
2. Accept only bounded ciphertext, reject unsupported versions/algorithms and untrusted content.
3. Verify approved issuer signature, AEAD integrity, artifact ID, provenance, tenant binding, capability, expiry and replay controls.
4. Release decryption keys only to an authorized, scoped server/recipient workflow; never put universal keys in browsers, repos, public Workers or logs.
5. Provide a READ-ONLY sanitized preview. No arbitrary HTML/JS, external scripts, privileged agent side effects or automatic writes.
6. Require explicit authorized human approval before idempotent creation of DRAFT business records using existing TEBE services.
7. Record artifact hash/issuer, approver, target workspace, receipt, created draft IDs and outcome in audit without storing customer plaintext in logs.

## Future safe export flow
- Run existing tenant/entitlement checks and create the minimum structured payload with provenance.
- Encrypt with audited algorithms using fresh keys/nonces and recipient key envelopes; sign using separate restricted signing keys.
- Deliver ciphertext through bounded, revocable access, retaining existing standalone PDF/HTML formats where promised.

## Required acceptance matrix
- Synthetic TO producer to TEBE verifier/viewer round trip.
- Tampering, invalid tags/signatures, wrong tenant/key, revoked grant, unknown version, oversized files, malicious HTML and duplicate receipt rejection.
- Tenant RLS and role authorization in disposable PostgreSQL; no production data.
- Human approved draft import, revocation handling and traceable audit receipt.
- Independent crypto/security review, CI success, feature flag disabled by default, deploy/rollback review.

## Owner recovery and security rules
- Customer-managed/zero-knowledge keys remain inaccessible to the platform without the customer's key.
- Platform-owned asset recovery requires narrowly scoped, auditable authority. No hidden super-admin cross-tenant decryption.
- Never weaken RLS, grant agents elevated rights, enable paid services or run migrations in this documentation PR.

## Delivery plan
P0: reviewed GAIZ v1 specification and key custody decisions.
P1: verifier and read-only preview behind a disabled feature flag.
P2: human-approved draft import and reviewed export.
P3: end-to-end security validation and separately approved release.

Related upstream proposals: TO PR #26 and #27.
