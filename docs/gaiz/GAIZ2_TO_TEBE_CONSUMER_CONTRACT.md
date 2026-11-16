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


## Experimental recipient custody-preview seam (not a deployed worker)

`gaiz2-verifier.mjs` now additionally exposes a
`verifyGaiz2RecipientForCustody` helper that validates the **entire**
canonical Ed25519-signed GAIZ2 envelope before returning a single
backend-selected recipient's *encrypted* RSA-OAEP key, plus the authenticated
manifest and AES-GCM fields. It never returns a DEK.

`gaiz2-custody-preview.mjs` is a production-disabled, unregistered
development adapter. It requires a trusted server-provided issuer verification
key, tenant-specific authenticated preview capability, recipient key ID, and
an injected `custodyProvider.unwrapSyntheticRecipientDek` method. Only after
successful signed-byte and tenant checks does it pass a frozen request
(`tenantId`, `artifactId`, `issuerId`, `envelopeSha256`,
`recipientKeyId`, `wrappedKey`, `algorithm`, `purpose`) to the custodian.

The custodian **must independently authenticate** its caller, establish
recipient entitlement and tenant/workload access, and audit/unlock the correct
RSA-3072+ OAEP-SHA256 key. Neither an injected JavaScript provider object nor
the string `purpose='synthetic-preview-only'` proves those requirements.
No real KMS, mTLS ingress, custody credentials, key rotation, revocation,
or key-use audit has been configured.

The adapter checks the returned 32-byte DEK's AES-256-GCM tag and canonical
report JSON; returns a *title-only*, inert metadata preview with
`authorizationGranted:false` and `importAllowed:false`; and clears its
local DEK and decrypted plaintext buffers on success and failure. The
custodian remains responsible for erasing the original key material and for
limiting unauthorized unwrap operations. Do not make this function callable
from a public API or a general-purpose application role.

The 2 new synthetic tests cover authorized in-memory RSA unwrap and refusal
to contact custody for invalid tenant, issuer, recipient, signature and
entitlement. They are registered in deferred CI, **not executed** in this
authoring environment.

Further required before any real GAIZ2 import: pinned producer-signed
cross-runtime fixture, independently administered issuer trust policy,
trusted recipient credential/key broker, tenant RLS migration, verified
structured mapping, distinct human approval, transactionally claimed worker
assignment, durable receipt and executable PostgreSQL acceptance.
