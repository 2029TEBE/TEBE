# GAIZ encrypted host-local artifact driver — review and deployment handoff

**Payments deferred. Code only. No live filesystem or production secrets configured.**

This PR follows GAIZ draft #529 and connects the existing private artifact adapter (#527)
to a real **host-local encrypted file** storage driver. It does not activate an
EPMO/ORGAIZ HTTP route, run a background worker or apply DB migrations.

## Implemented

- `gaiz-encrypted-file-object-store.mjs`: AES-256-GCM authenticated encryption
  with fresh 96-bit nonce per immutable object, authentication bound to the exact
  server-generated object key, and SHA-256 digest for the plaintext.
- File reads are bounded, reject tampering and incorrect encryption keys and
  require non-public access. Stored files use 0600 permissions under a 0700
  directory. Object filenames are restricted to random 64-character lowercase
  hex segments; traversal and symlink leaf reads are denied. Existing files
  cannot be overwritten by the API (`O_EXCL`).
- `gaiz-encrypted-local-artifact-bundle.mjs`: composes this driver with the
  existing `createGaizPrivateArtifactStore()` from #527. Only the server injects
  a protected disk path, PostgreSQL pool and encryption key; no user-facing URL.
- `gaiz-encrypted-file-object-store.test.mjs`: five tests were **actually
  executed locally** with `node --test` and all passed:
  disabled/malformed key, private encryption roundtrip, ciphertext tampering
  and wrong key, public/path/size denials, and a symlink read denial.

## Required hardening before staging/production

1. **Key management**: supply the 32-byte key from a dedicated secret manager
   or encrypted root-owned file; never commit keys or inject them into browser
   code. Design key IDs/rotation and envelope encryption before real customer
   data exists. Loss of the key means loss of all reports.
2. **Storage mount**: provision a dedicated persistent, backed-up, encrypted
   volume on the server. The directory itself must be owned by the dedicated
   GAIZ process, permission 0700, not symlinked, and *never* mounted beneath a
   public static-site document root. Verify parent directories and mount
   boundaries under actual OS permissions; this source is not a full
   defense against a compromised host or directory replacement.
3. **Durability**: file fsync is used; production needs crash-recovery,
   directory sync where supported, incomplete-object quarantine, restore
   tests, disk space alerts, file retention, orphan garbage collection and
   database-to-object reconciliation. This local driver is single-host only
   and does not provide cross-host HA or remote object storage.
4. **PostgreSQL/RLS**: apply reviewed migrations and tenant/worker grants from
   the proposals in #527-#529. Ensure immutable metadata object-key mapping,
   live customer/job/order authorization and audit under proper transactions.
   No production migration is applied by this PR.
5. **HTTPS delivery**: use the owner-bound read adapter, never expose object
   paths or keys to the browser. Force `Content-Disposition: attachment`,
   no-store, bounded reads, fixed MIME, rate limits, session/CSRF as appropriate,
   and isolated serving of HTML. Revoked/refunded artifacts must not download.
6. **Staging**: run the Node tests against the exact deployed version, then
   integration tests on the real storage mount and PostgreSQL. Exercise
   disk-full errors, power-loss recovery, partial writes, key rotation,
   concurrent writes, invalid symlinks, volume permissions, digest mismatches,
   customer authorization, refund/revoke and backups.

## Validation

On the current local development copy the five unit tests passed
(5 pass / 0 fail). This does **not** claim the full TEBE repository suites,
PostgreSQL integration, deployment or GitHub Actions checks passed.

```sh
node --test apps/api/src/gaiz/gaiz-encrypted-file-object-store.test.mjs
```

**Release status:** draft review only, not merged, not deployed, no real data
written. Existing Stripe/Paddle settings remain unchanged.
