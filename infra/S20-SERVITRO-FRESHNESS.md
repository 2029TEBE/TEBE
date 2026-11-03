# S20 — Servitro evidence freshness (offline only)

Run `node --test infra/servitro-evidence-freshness.test.mjs`. This validates **synthetic metadata**, not provider signatures or external truth. No network calls, credentials, DNS, deploy, or database changes.

Use `checkEvidenceFreshness(bundle, now)` after independently collecting and verifying the S19 integrity bundle. Every category must refer to the same immutable release SHA, image digest and `isolated-nonproduction` environment. Reject stale HTTPS/alert evidence and future-dated observations. This does not authenticate who created the receipts, verify TLS or authorize deployment: `operationallyVerified` and `deploymentAuthorized` remain false even when `accepted` is true.

**Operator acceptance (still blocked):** independently attest Servitro deployed image and SHA; capture real TLS and HTTPS health probes; verify restricted-role tenant isolation in a real isolated staging environment; perform encrypted off-host backup and isolated restore; prove alert delivery and protected rollback; obtain independent review. Record timestamp, source, and immutable digest without uploading secrets or customer data. Q87 #366 CI and disposable PostgreSQL recovery are source/synthetic evidence only. Do not change live DNS/MX, mailboxes, secrets, Stripe or production. Canonical issue #1 remains NO-GO until external gates are accepted.
