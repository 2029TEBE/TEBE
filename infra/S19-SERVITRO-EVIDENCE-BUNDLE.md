# S19 — Servitro evidence bundle integrity (offline only)

This tool checks that eight **locally supplied** operational evidence files match SHA-256 digests in a manifest and all declare the same immutable 40-character release SHA. It never queries Servitro, Stripe, DNS, Cloudflare, mail, or a live host, and never authorizes a deployment.

Run: `node infra/servitro-evidence-bundle.mjs /path/to/synthetic-manifest.json` or `node --test infra/servitro-evidence-bundle.test.mjs`. The manifest has `schemaVersion: 1`, `releaseSha`, and exactly eight `artifacts` with `category`, relative `path`, lowercase hex `sha256`, and matching `releaseSha`. Categories: image-attestation, https-health, nonprod-isolation, encrypted-backup, isolated-restore, alert-delivery, rollback-drill, independent-review.

**Critical limitation:** A digest only detects changes relative to the supplied manifest. A malicious or mistaken operator can replace both files and manifest. Real acceptance requires independent trusted provenance, verified deployed image and source SHA, TLS/HTTPS receipts, separate network and database, encrypted off-host backup with isolated restore, observed alert delivery, rollback drill, and signed independent review tied to the **single integration exact head**. Do not place tokens, credentials, customer data, or raw mail in artifacts or CI logs. Keep real operational receipts outside the repository in controlled access storage.

Q86 review-only candidate #363 (`cff43a2992ac973626f7da98f604ba5278fc44da`) was the base for S19. Its CI and disposable recovery runs are **source-level evidence only**, not real Servitro staging/backup proof. Q79 #344 and C62 #346 are historical integration inputs, not current live evidence. Stripe TEST receipts remain 0/7 independently verified. Live DNS and mailboxes must remain unchanged.

**Blocked/deferred:** Servitro credentials/attestation, real nonproduction isolation, external health probes, backup restore, alert receipt and independent approval. Do not treat any missing item as passed. Release remains NO-GO.


### Q87 local file hardening
The integrated verifier resolves the evidence-directory real path and rejects symlinked artifact files, files whose resolved paths escape that directory, non-regular files, and files larger than 1 MiB *before* reading their contents. Synthetic disk-level regression tests cover symlink, ordinary file and oversized file cases. This still attests **only local integrity**, never Servitro, email, Stripe or deployment authorization.
