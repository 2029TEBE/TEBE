# Amuse integration boundary for THEEPMO

Status: source review and discovery-validator hardening; no Amuse runtime enabled.

Canonical intake and pinned source:
https://github.com/faisalwrokksa-hub/TO/blob/main/docs/vendor/amuse/GIZE-ADOPTION.md
Uploaded archive SHA-256: `849f5ea2463afd80175dff6eb3ca137cd24c9a7655ba2224bb55ee087ebdcec7`.
Companion OT source intake: https://github.com/faisalwrokksa-hub/TO/pull/110.

Amuse supplies useful approval and credential-placeholder patterns. Its no-login,
single-user loopback server and local vault must not become THEEPMO authentication,
tenant storage or GIZE artifact encryption. Do not duplicate upstream source here.

The existing `apps/api/src/gaiz/ao-native-handshake-policy.mjs` now snapshots own
data fields, refuses hidden/symbol authority fields and accessors, and handles
throwing/revoked proxies by denying discovery. It never executes tools or grants
tenant access. Required own fields and the exact disabled v1 handshake remain.

Validation: 9 targeted TEBE tests pass, including hostile-object regression tests.
Combined with OT: 28 tests pass; no database or external provider required.
This is not full `pnpm verify`, RLS acceptance, hardware acceptance or deployment.

Before runtime integration: server-derived tenant/principal, exact-origin secret
resolution with OS/KMS custody, permission and entitlement enforcement, approval
scope/expiry/revocation, bounded quotas and audit receipts are required. Preserve
GAIZ1/GAIZ2 signatures and `.gize` / legacy `.gaiz` interoperability. Keep customer
plaintext and upstream API keys outside public/browser storage and logs. Do not
expose Amuse's port, install its scheduler, enable paid calls or alter RLS here.

Track further work in #642; no requirement is promoted to VERIFIED by this note.
