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
