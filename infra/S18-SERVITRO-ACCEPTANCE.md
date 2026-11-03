# S18 Servitro isolated acceptance (NO-GO until independently evidenced)

This is an **offline schema/consistency check**, not provider attestation, deployment authorization, a real restore, or proof that any service is running. Never commit real credentials, backup identifiers, customer records, raw probe output, or signed attestations. Store sensitive receipts in an access-controlled external evidence store and reference sanitized evidence identifiers in the independent release review.

## Integration handoff
- Q79 integration PR #344 and C62 billing PR #346 are historical green handoffs, **not automatically evidence for the current candidate SHA**.
- Q81 #351 includes the two S17 Servitro preflight files on the Q80 base; Q82 #352 adds the Cloudflare email adapter. Coordinate any S18 cherry-pick with the integration coordinator and rerun CI at its **new exact head**. Do not merge the S17 stacked branch wholesale.
- Current deployed SHA, image digest attestation, actual isolated staging, TLS probe, mail sending, backup restore, alert delivery, rollback drill, independent operator review: **DEFERRED / NOT VERIFIED**. Owner reports public domain routing works; do not reopen DNS.

## Operator acceptance sequence (separate target-specific approval required)
1. Identify immutable release-candidate 40-hex SHA and image digest from trusted build provenance; independently inspect Servitro runtime and compare deployed SHA/digest. Never infer deployment from a GitHub commit.
2. Identify isolated nonproduction target, Saudi provider eligibility, separate network/database/storage/KMS/logs, synthetic tenant accounts and restricted credentials. Reject any production-connected target.
3. Probe the authorized isolated HTTPS health/readiness endpoint with certificate verification, record sanitized HTTP status and deployed SHA. Verify WEB_ORIGIN, MAIL_TRANSPORT and Stripe **TEST** mode without printing credentials or executing real charges. Do not equate the production app URL with an isolated staging URL.
4. Confirm encrypted off-host backup reference and retention. Restore into an isolated disposable database, verify integrity and tenant isolation; do not restore over shared or production data.
5. Demonstrate delivery of health-failure and backup-freshness alerts, then a protected rollback drill to a distinct immutable previous SHA using expand-only migration compatibility.
6. Have an independent operator sign off exact-SHA receipts, then independent security, billing, legal and tenant-isolation gates. Any missing receipt remains BLOCKED, not passed.

## Offline developer check
Run `node --test infra/servitro-evidence-gate.test.mjs`. For an approved, **sanitized local JSON declaration** run `node infra/servitro-evidence-gate.mjs /path/to/local-evidence.json`. The script never contacts hosts or writes infrastructure. Its `accepted:true` means only that the supplied claims are internally consistent; it **cannot validate truth or authorize deployment**. It intentionally returns only generic error keys.

## Outstanding blockers
Servitro provider credentials/target and verified deployed image SHA, isolated acceptance environment, live HTTPS/TLS receipt, actual backup/restore integrity, alert delivery, rollback drill and independent signoff are absent. These are deferred, not waived. Replacement deliverable in S18: fail-closed offline acceptance contract plus negative tests. Protected production release remains **NO-GO**.
