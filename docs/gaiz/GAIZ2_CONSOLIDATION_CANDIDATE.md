# GAIZ2 cross-repository consolidation — development candidate (2026-11-16)

**Status:** Review only; draft stacked against TEBE PR #504 branch. Source snapshot: TEBE PR #504 `46a70df87d518f164bb68a7fea703d7972172d9e` and PR #507 `a78391a48abd9276c71bd331d47d4e42a07cca77`.

## Included
- Preserve PR #504's tested GAIZ2 preview controller/module, isolated PostgreSQL GAIZ migrations 0020–0027, trust directory and guarded staging.
- Carry 68 non-overlapping PR #507 enterprise workflow files including schemas, policy and offline tests; retain the stricter default public-boundary behavior until independent acceptance.
- Move duplicate enterprise controller/module into an **inactive**, distinct candidate entry point; never register it with AppModule.
- Preserve `verifyGaiz2ForPreview` and add a separately implemented enterprise quarantine/recipient verifier through an explicit re-export. Neither authorizes imports or unwraps recipient keys.
- GAIZ2 remains defined by TO, not by TEBE; no envelope format fork is approved.

## Must pass before proposing merge
1. PR #504 and PR #507 full CI independently on exact frozen source revisions.
2. Combined source guards and compile/typecheck; run enterprise workload challenge/replay tests with installed dependencies.
3. Isolated PostgreSQL migration and RLS suite with tenant mismatch, replay, revoked trust and reviewer separation; no production DB modifications.
4. TO independently signed synthetic GAIZ2 fixtures, full negative tamper/replay/rotation tests and independent browser inspector tests in TEFE.
5. Manual conflict review for overlapping controller/module, v1/v2 verifier/tests, README and app UI. Keep enterprise creation/import routes inactive until custodial infrastructure and security acceptance.

## Deferred release gates (not auto-approved)
- Real customer-controlled KMS/HSM, separate custodian identity and key rotation/revocation, operational PKI/mTLS and private-key custody.
- Security review of encryption protocol, offline verification, side-channel and cryptographic robustness.
- Production rollout, migrations, live decryption, retention and real data import.

**Auto-approval scope:** create reviewable development commits and run non-production CI; not unattended production key releases or security-gate bypasses.
