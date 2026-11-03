# S25 — Servitro operational evidence inventory (non-deploying)

Run `node --test infra/servitro-ops-inventory.test.mjs`. To validate a local operator-supplied JSON inventory, run `node infra/servitro-ops-inventory.mjs /absolute/path/to/inventory.json`. This script does **not** contact Servitro, change DNS, inspect mail credentials, perform a restore, or authorize a deployment.

Eight mandatory categories: independently attested deployed image, HTTPS health, restricted-tenant RLS, encrypted off-host backup, isolated restore, alert delivery, protected rollback, and actual two-way mail. Each receipt must identify the same immutable source SHA, a recent observation and an evidence reference. References are declarations and must be independently checked by a release reviewer. Do not include secrets or production customer data in evidence manifests. A structurally valid inventory is **not** proof of provider acceptance.

**Known blocked external checks (2026-11-03 UTC):** Servitro guest mail ports 465/587/993 refused externally; guest console unavailable. Do not send Servitro support messages without separate owner approval. Public app signup remains unverified after draft PR #388; isolated build success is not a live deployment. Paddle disabled and merchant/sandbox receipts unverified. Keep release NO-GO until independent evidence and canonical issue #1 signoff.
