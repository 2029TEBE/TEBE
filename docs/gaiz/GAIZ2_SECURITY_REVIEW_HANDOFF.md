# GAIZ2 security review handoff — 2026-11-16

**Status: internal readiness analysis, NOT an independent audit or production approval.**

## Review targets
- Canonical format producer: `faisalwrokksa-hub/TO`, PR #30. Protocol `gaiz/CONTRACT-v2.md`.
- Combined TEBE consumer: PR #533 (stacked on #504), with enterprise source in PR #507.
- Public browser inspector: `2029TEFE/TEFE`, PR #43, separate from backend custody.

## Confirmed development assertions (verify on frozen exact SHA)
1. GAIZ2 unsigned canonical envelope is Ed25519-signed and bound to issuer and tenant scope from independent backend trust policy.
2. Recipient RSA-OAEP-SHA256 wrapped keys must be at least 384 bytes (RSA-3072 minimum); only opaque wrapped ciphertext crosses metadata boundaries.
3. The GAIZ2 preview, enterprise quarantine, and custody candidate expose no production import permission; the custody candidate fails closed under `NODE_ENV=production`.
4. Synthetic mTLS worker challenge and replay tests, isolated PostgreSQL RLS, and transaction rollback acceptance are mandatory CI coverage.
5. Enterprise candidate controller/module is **not** registered with AppModule. Guarded preview route is distinct; do not confuse preview with production authorization.

## Independent reviewer must verify
- Reproduce TO-generated deterministic vector in TEBE and TEFE using independently trusted keys; inspect parser complexity, duplicate JSON keys, Unicode normalization, length bounds, canonical signatures and envelope substitution resistance.
- Audit recipient key confidentiality, private-key creation, origin, identity binding, rotation, disabled/revoked issuer policy, key loss, KMS/HSM authorization and full scope binding independently of GAIZ artifacts.
- Analyze compromised employee/worker, replay under parallel connections, mTLS trust-store changes, challenge exhaustion, tenant context confusion, service-role and database privilege escalation.
- Require end-to-end audit logging without plaintext, DEK, raw credentials, signed challenge tokens, sensitive metadata or secrets.
- Evaluate disaster recovery, offline key escrow governance (if any), expiration semantics, inability to revoke delivered offline copies, incident response and retention policy.
- Review production environment and route activation separately. **CI success is not an external penetration test or custody approval.**

## Required evidence for release decision
- Freeze exact TO, TEBE and TEFE commit SHAs and export CI logs; reproduce isolated PostgreSQL tenant/RLS/concurrency tests and browser inspector tests.
- A human cryptography and security reviewer signs the protocol and access control findings, with severity-tracked remediation and retest evidence.
- Independent customer-controlled KMS/HSM in a non-production test tenant; key rotation, revocation, lost-key and cross-tenant access denial demonstrations.
- Production deploy runbook and rollback with data protection and incident response sign-off. Explicit approval required for activating real imports, decrypts, private keys or production DB migrations.

**Non-goals:** Enabling payments, changing production data, deploying GAIZ routes, or promoting review-only CI success into operational acceptance.
