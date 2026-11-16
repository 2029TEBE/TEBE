# GAIZ / TEBE verification boundary (candidate)
This module is an isolated **read-only** consumer of TO's proposed `GAIZ1` envelope.
It validates signature and tenant scope using a backend-controlled issuer public key.
It does not authenticate the requesting user, decrypt data, grant import privileges,
write to the database, or expose a public endpoint. Do not wire it into NestJS controllers
until key trust, authenticated tenant authorization, content validation, and explicit
approval and audit paths have been designed and reviewed.
Test: `node --test apps/api/src/gaiz/gaiz-verifier.test.mjs`.

## Enterprise foundation (inactive)
The new `gaiz-workflow.mjs` implements pure deny-by-default workflow transition
and replay-namespace policy. `gaiz-orchestrator.ts` is an unregistered NestJS
integration seam; no REST routes exist and writes are not enabled.
See `docs/gaiz/IMPLEMENTATION_HANDOFF.md` and the proposed (unapplied) schema.
The protocol remains experimental until TO interoperability and key custody are
approved. Run offline policy tests with `node --test apps/api/src/gaiz/*.test.mjs`.

## Consolidation preview (review-only, 2026-11-16)
The combined GAIZ2 preview uses the proven read-only staging/verifier module from PR #504; it carries over the inactive enterprise workflow candidate from PR #507 in `gaiz-enterprise-candidate.controller.ts` and `gaiz-enterprise-candidate.module.ts` without importing either into the production AppModule. The enterprise quarantine/recipient verifier has a separate implementation at `gaiz2-enterprise-verifier.mjs`; both verifier profiles remain independently subject to tests and use no actual customer DEK. Re-exported enterprise verifier functions do not imply release acceptance.

**No runtime GAIZ import, cross-tenant writes, user data, KMS/HSM connection or key release is enabled by this combined preview.** TO is the canonical GAIZ2 producer. Eight overlapping files require explicit behavior compatibility and human/security review, even if CI is green. Production DB migration execution, real custody, cryptographic interoperability and key-rotation drills remain gated. Do not merge the stacked PR directly to main until its base PR and full combined CI are approved.
