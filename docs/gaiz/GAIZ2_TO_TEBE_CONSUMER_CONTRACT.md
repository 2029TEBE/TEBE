# GAIZ2 consumer alignment — TEBE / TO (draft, 2026-11-16)

**Status:** Experimental. The existing GAIZ1 verifier remains a separate,
inactive consumer. Do not silently upgrade GAIZ1 bytes or treat the GAIZ2
cryptographic receipt as import authorization.

## Upstream reference implementation

TO [GAIZ2 PR #30](https://github.com/faisalwrokksa-hub/TO/pull/30)
contains `gaiz/v2.mjs` with an experimental `GAIZ2\n` envelope:

- Ed25519 issuer signature over domain-prefixed canonical JSON, including
  manifest, AES-GCM fields **and the complete recipient list**.
- Manifest version 2, schema version 1, report MIME type, issuerId,
  artifactId, tenantScope and UTC createdAt.
- Fresh per-artifact 32-byte AES-256-GCM DEK and 12-byte nonce; canonical
  manifest used as AEAD AAD.
- 1–8 ordered recipient `{keyId,wrappedKey}` entries. The current TO
  reference uses RSA-3072+ OAEP-SHA256. Recipient private keys belong to
  independent custody, not TEBE application traffic.
- The format is not declared production-frozen. TO PRs #31, #32, #33,
  and #35 remain separate review branches for cross-runtime evidence,
  signed fixtures, canonicalization and recipient ordering.

## New TEBE implementation

`apps/api/src/gaiz/gaiz2-verifier.mjs` is an independently implemented,
unregistered, metadata-only verifier for the candidate signed GAIZ2
container. It rejects GAIZ1 magic, duplicate or noncanonical JSON keys,
invalid sizes/versions, recipient duplicates/disorder, unexpected schema,
wrong issuer/tenant and invalid Ed25519 signature. It returns a frozen
receipt with the envelope SHA-256, signed artifact and issuer IDs and
`authorizationGranted:false` / `importAllowed:false`.

`gaiz2-verifier.test.mjs` generates isolated synthetic Ed25519,
RSA-OAEP and AES-GCM material in memory, checks signature and negative
issuer/tenant/tamper cases, and is included in the *deferred* offline CI.

**No decryption, custody request, private key release, database mutation,
workflow approval, public route, registered Nest module or import right
is implemented by this verifier.**

## Outstanding agreement and release gates

1. Obtain a reviewed, pinned GAIZ2 byte-level protocol and independent
   non-Node fixture (TO #33) with conformance results for TEBE.
2. Approve issuer key ID, signed trust directory, rotation/revocation,
   live recipient key ownership, access control and key custody.
3. Align report payload schema: the GAIZ2 sample has a distinct report
   structure from TEBE's GAIZ1 `{schemaVersion,title,summary}` mapping;
   no implicit conversion or writing to business tables.
4. Establish authenticated worker runtime, approved tenant RLS migration,
   replay-unique assignment claim and separate human approval before any
   atomic draft insert.
5. Run full Node TypeScript tests, actual PostgreSQL tenant/concurrency
   tests and independently reviewed security release checks. The user
   deferred GitHub Actions execution for development only; release gates
   are never auto-waived.

No production activation, KMS provisioning, merge or deployment authorized.
