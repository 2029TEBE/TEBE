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


## Pinned TO-to-TEBE GAIZ2 interoperability fixture

The TEBE draft branch now vendors the *synthetic* reference fixture from
[TO PR #33](https://github.com/faisalwrokksa-hub/TO/pull/33), specifically
`gaiz/fixtures/v2-fixed-001/` at the reviewed producer fixture branch.
The exact producer-supplied `valid.gaiz.b64`, `issuer-public.pem`, and
`expected.json` live under
`apps/api/src/gaiz/fixtures/to-gaiz2-fixed-001/`.

`gaiz2-cross-repo-fixture.test.mjs` requires **byte-identical** GAIZ2
encoding (1,123 bytes, SHA-256
`14e8a1f6ccc4dd0cf021dfd78a6d03f43f4124ea7854767b1052bcc6c01b5aef`),
an Ed25519 signature verified with the *pinned public key*, the producer's
issuer/tenant/artifact IDs, and an import-denying metadata receipt. It also
checks that a selected recipient descriptor contains *wrapped ciphertext*
rather than a DEK or plaintext and rejects tampered bytes, changed trust
anchors, wrong tenant or issuer, and unknown recipient.

The fixture contains **no recipient private key, live credentials, customer
data, or decryption authority**. It is a consumer **signature-and-wire**
conformance test, *not* a key-custody or authenticated-import end-to-end
test. The four tests are registered in deferred GitHub CI but have **not
been executed in a Node environment here**. TO PR #33 is still a review
branch and its fixture should not be called a ratified final GAIZ2 standard
until protocol owner sign-off and independent review occur.

Further gates: obtain protocol owner freeze (including ordering policy),
KMS-backed recipient authorization, independent issuer rotation and
revocation, externally attested workload identity, approved DB/RLS
migrations, atomic assignment/approval/import and real CI/Postgres
conformance under the reviewed commits. No route or production release.


## Dual-signed verifier workload / GAIZ2 recipient binding

TEBE now includes an **unregistered development-only** policy seam,
`apps/api/src/gaiz/gaiz2-worker-recipient-binding.mjs`, and three synthetic
tests in deferred CI. It requires two independent trust anchors: the
Ed25519 issuer of short-lived GAIZ verifier worker assignments and the
Ed25519 issuer of the GAIZ2 envelope.

The function independently verifies the signed assignment against a
backend-supplied verifier worker ID, role, tenant UUID, work-item UUID and
time/expiry; then verifies the **complete signed GAIZ2 envelope** and
selected recipient ciphertext, binding the envelope tenant scope to the
assignment's tenant UUID. It returns an immutable metadata request with
assignment ID, work item, artifact digest, recipient key ID and opaque
wrapped key. It explicitly declares:
`databaseClaimRequired:true`,
`custodyAuthorizationRequired:true`,
`authorizationGranted:false`, and `importAllowed:false`.

The candidate deliberately **refuses non-UUID tenant scopes** rather
than guessing an application tenant mapping. This means the separately
pinned `synthetic-tenant` TO vector is only a *signature conformance*
fixture, not a worker-custody integration fixture. A future reviewed,
trusted tenant-scope directory is required to support non-UUID scopes
safely.

The supplied `workload` descriptor is **not actual mTLS/workload identity
proof**: its values must come from a security-reviewed ingress, not
HTTP headers or file bytes. The signed assignment may still be replayed
until a dedicated database worker role performs a transactionally unique
claim. A custodian must separately authenticate the caller and enforce
authorization/revocation **before key use**. This module contains no
credential broker, KMS implementation, DEK release, actual mTLS
validation, database claim, import, Nest registration, or public API.

Positive and negative synthetic tests cover paired signatures, tenant,
role, work item, key, expiry, tampering, production disable and lack of
import authorization. They are committed to **deferred**, not executed,
Node CI; there is no claim of operational authentication.


## Independent signed workload credential candidate

The inactive development branch now contains
`gaiz-signed-workload-credential.mjs`, which checks an Ed25519
credential-issuer signature in domain `GAIZ_WORKLOAD_CREDENTIAL_V1`
over canonical worker identity, role, issuer, issuance/expiry and a
**server-generated 32-byte random challenge**. It rejects mismatched
challenge/worker/role/issuer, invalid or excessive time windows, malformed
or duplicate/noncanonical fields and untrusted signing keys. It returns
frozen identity metadata with `independentTransportAuthenticationRequired`
and `atomicChallengeClaimRequired`, and `importAllowed:false`.
This issuer key must come from an independently administered backend
trust directory, **not** GAIZ bytes or user headers.

`bindGaiz2RecipientWithSignedCredentialCandidate` (inside the
development-only `gaiz2-worker-recipient-binding.mjs`) derives its
workload descriptor from that **verified credential**, disregarding a
caller-provided `workload` field. It then checks the independent signed
assignment and signed GAIZ2 recipient artifact, returning only encrypted
recipient metadata with `custodyAuthorizationRequired:true`,
`databaseClaimRequired:true` and `importAllowed:false`.

**This is NOT operational mTLS, proof-of-possession or replay control.**
A copied issuer-signed credential can still be presented by another
party unless the trusted ingress independently authenticates the
presenter/transport and atomically consumes the backend-issued challenge
in a short-lived replay ledger. Those pieces, issuer revocation, a
dedicated worker DB identity, real KMS custody policy and assignment
claim remain separate required engineering work. The helper must never
be wired directly to a public route or an authorized key-unwrapping
operation. No KMS integration or production service has been created.

Four new credential-verifier test cases and two additional combined
binding test cases are committed and registered in deferred CI. They
have not been executed by Node, the official TypeScript build, a real
identity ingress or PostgreSQL.


## One-time workload challenge replay ledger (draft only)

The TEBE draft now contains two disconnected replay-control candidates and
a **review-only** PostgreSQL proposal:

- `packages/db/sql/gaiz-workload-challenge-review-proposal.sql` defines a
  SHA-256 challenge digest table (no raw challenge), issuer, tenant, worker,
  work item, role, expiry, and single `consumed_at` marker. It proposes
  `FORCE ROW LEVEL SECURITY`, no `pmo_app` access, an isolated
  `gaiz_challenge_issuer` INSERT role, and scoped SELECT /
  `UPDATE(consumed_at)` for non-owner verifier/executor DB roles.
- `gaiz-workload-challenge-claim.mjs` checks the actual PostgreSQL
  `current_user` and transaction-local `app.tenant_id`, then uses one
  conditional `UPDATE ... WHERE consumed_at IS NULL ... RETURNING` with
  the database clock, independently binding the pre-issued challenge digest
  to tenant, work item, worker, purpose and credential issuer. A second
  use or wrong role/tenant returns no accepted claim.
- `gaiz-workload-transaction-candidate.mjs` is a separate DEV-only
  composition candidate: independently verifies signed workload credential
  and signed worker assignment, enters **one caller-owned transaction**,
  consumes the challenge, then consumes the assignment claim and invokes
  the review callback. A thrown callback must cause the database's
  transaction wrapper to roll back both claims and the operation.

**Not implemented or approved:** Issuing a backend-generated challenge
into a real database, trusted mTLS/PoP validation, key pinning and revocation
policy, role provisioning, database migrations, PostgreSQL RLS and concurrent
rollback tests, KMS unwrap, human approval or business import. There is
no live ingress, public route, Nest registration or production use. This is
*not* a fully authenticated worker runtime. The caller's DB `transaction`
and injected assignment claim must be assembled only by separately trusted
worker code; the draft explicitly refuses to accept caller-provided
`transportAuthenticated:true` flags as evidence.

These files are included in deferred offline CI with synthetic/mock tests
and source-order assertions. No real PostgreSQL RLS claim or concurrent
worker operation has been executed. The SQL is deliberately **not** wired
into automatic migrations: security review must independently verify DB
role inheritance, FORCE RLS, grant semantics, issuer enrollment,
tenant-scoped cleanup and lease/replay retention before promotion.


## Verified TLS peer candidate — server-side identity binding

The new inactive GAIZ ingress candidates
`gaiz-mtls-peer-candidate.mjs` and
`gaiz-mtls-signed-credential-candidate.mjs`
introduce a **real TLS-socket source boundary** rather than accepting
`authenticated:true` flags or request headers. The peer verifier requires
an actual Node `TLSSocket` with `encrypted===true`,
`authorized===true`, no TLS authorization error and TLS 1.3.
It reads the peer certificate's raw DER, computes SHA-256, and requires
an exact fingerprint entry in an independently administered backend-owned
worker registry. That entry binds worker UUID, permitted role,
credential issuer, credential validity window, and `revoked:false`.
It also independently checks certificate validity.

The composition verifies a **separate signed workload challenge
credential** against the worker ID and role authenticated from the
certificate. It rejects a credential from a different worker, role,
challenge or issuer, and returns immutable inert identity evidence with
`challengeClaimRequired:true`, `assignmentClaimRequired:true`,
`custodyAuthorizationRequired:true` and `importAllowed:false`.

The server-side integration contract MUST enforce all the following:
TLS `requestCert:true`, `rejectUnauthorized:true`,
`minVersion:'TLSv1.3'`, a separately provisioned trusted client CA,
no general-purpose web routes, and invocation **only from a trusted
TLS server's `secureConnection` event**. The certificate fingerprint
registry and credential issuer public key must be supplied from server
configuration, never request/GAIZ data. Worker TLS keys and certificates
need audited provisioning, revocation and renewal. Trust and transport
configuration must be verified by an independent security review.

A new `gaiz-mtls-peer-candidate.test.mjs` creates **ephemeral**
self-signed test certificates using local OpenSSL and exercises a real
localhost Node TLS 1.3 mutual handshake, as well as signed-credential,
revocation, wrong-registry, expired-credential and production-disable
negative cases. Test keys never enter the repository. The test is
registered in deferred CI. A separate local handshake smoke proof
confirmed `authorized=true`, protocol TLS 1.3 and accessible peer
certificate bytes. **The entire new Node test file has not been
executed against the branch**; complete CI, PostgreSQL and KMS
acceptance remain pending.

**No production service is registered or deployed.** The TLS verifier
does not pre-issue or consume a challenge, claim assignments, create
DB worker credentials, decide import approvals, authenticate KMS
requests or release plaintext. These operations must only be composed
under independently audited infrastructure and a single durable,
tenant-restricted database transaction.


## Authenticated mTLS challenge issuance candidate

The disconnected `gaiz-mtls-challenge-issuer-candidate.mjs` now closes
the **issuance side** of the draft challenge protocol. It begins with the
actual verified TLS 1.3 peer certificate (not an HTTP header or
`authenticated` flag), verifies the independently provisioned worker
fingerprint and role, and calls a **backend-owned work-item entitlement**
lookup. That lookup must independently check the tenant and work item
against authoritative records; an arbitrary injected callback is not
proof of entitlement.

Only after the checks pass does it generate 32 cryptographically random
bytes, store **only SHA-256(challenge)** along with the exact tenant,
worker, work item, role, credential issuer and a maximum 30-second
lifetime, and require an actual affected-row count of one from the
database. The `gaiz_challenge_issuer` identity is checked using the
database's `current_user`; the INSERT is deliberately performed
without RETURNING, so an INSERT-only role does not require SELECT
privileges. If the transaction fails, the raw challenge is **not
returned**. The challenge is returned only after transaction success,
with `authorizationGranted:false` and `importAllowed:false`.

The peer registry, per-work-item authorization and isolated
`gaiz_challenge_issuer` connection must all be owned by the trusted
server, never provided through request data. The challenge consumer
must verify the separately signed credential and **atomically consume**
this same digest, with the assignment claim and business operation
inside the same transaction. This is not a full online protocol until
the server independently binds the issued challenge to the exact live
connection and the full issue→sign→consume exchange is tested.

The candidate is not registered in Nest or any listener. The existing
local TLS test suite now has two additional issuance scenarios for
a successful synthetic issuer transaction, wrong role, failed INSERT
and denied entitlement. The real test suite and PostgreSQL/RLS
acceptance are still **unexecuted** in the target repository.

Further release gates include reviewed challenge-issuer credentials,
actual worker identity directory, issuer trust/revocation,
dedicated non-owner worker roles, TLS-to-challenge session binding,
secure audit logging, DB migrations, concurrent single-use tests, and
key-custody authorization. **No production use or migration.**


## Independent custody policy grant verification (review-only)

`apps/api/src/gaiz/gaiz2-custody-grant-candidate.mjs` is an inactive
metadata-only policy verifier, not a key custodian. It validates a
separately signed Ed25519 `GAIZ2_CUSTODY_GRANT_V1` envelope under a
**server-pinned, independently administered custodian-policy issuer**.
The policy describes only one backend-derived tenant UUID, worker UUID,
work item UUID, assignment UUID, artifact and issuer IDs, envelope
SHA-256, recipient key ID and a fixed `gaiz2_metadata_preview` purpose.
Its maximum signed lifetime is 30 seconds; all fields must match the
server's independently authenticated evidence **exactly**.

The verifier deliberately **does not accept** `gaiz2_import` as an
allowed purpose, wrap/decrypt the selected DEK or return any encrypted
recipient key bytes. Its immutable receipt reports
`signedCustodyPolicyVerified:true` while continuing to require a real
transport authentication, durable one-time assignment claim, grant
replay control and independent KMS authorization:
`authorizationGranted:false`, `kmsReleaseAllowed:false`,
`importAllowed:false`. A valid policy signature is not a key-release
credential, substitute for human approval, or proof of tenant access.

Five new negative/positive cases check trust anchors, wrong work item,
recipient/worker/tenant/assignment, forged or expired grants, malformed
JSON and disabled production mode. The suite is included in GitHub CI;
the tests do not require access to real KMS credentials.

**Still required:** a genuine external KMS/HSM with authenticated
non-exportable recipient private keys, independently enforced key
policies, issuer rotation/revocation, approval ledger, grant single-use
under a durable storage claim, workload-to-KMS principal binding, a
zeroization/audit design and real custody integration tests. This
candidate MUST NOT be connected to `unwrapSyntheticRecipientDek`
or any production service. No real keys are provisioned or released.
