# GIZE Code Mode — TEBE enterprise boundary (source-only candidate)

Date: 2026-11-23. This change adds a bounded, tenant-filtered capability discovery helper in apps/api/src/ao/gize-code-mode-admission.mjs. It is not mounted as an API route and cannot execute operations.

## Integration steps still required
1. Resolve principal, tenant and capabilities through existing NestJS authentication and tenancy context; do not read tenant assertions from model-generated JavaScript or unsigned client payloads.
2. Authorize discovery for every capability through trusted policy. Do not infer execution permissions from tool visibility.
3. Map each executable API operation through the existing requireCapability and the enterprise deny-first AO policy. Verify per-operation grants, independent reviewer when required, rate limits, revocation, idempotency and audit.
4. Keep encrypted .gize/.gaiz artifact contents and key material out of model outputs and code sandboxes. The canonical format lives in TO.
5. Expose code execution only behind a reviewed isolated runner, a host-owned authenticated request proxy, and tested tenant isolation. Remote MCP and privileged transports remain denied until separately reviewed.
6. Verify security in disposable tenants, then run authenticated integration tests; production deployment and customer release remain gated.

Run source checks: node --test tests/gize-code-mode-admission.test.mjs
The test fixtures use synthetic principals. A fixture that marks itself authenticated is not real authentication; no test grants production authorization.
