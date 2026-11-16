# GAIZ2 bulk execution and automation gates — 2026-11-16

## Scope
TEBE PR #507 is **development-only**. Related work: TO GAIZ2 PR #30 and TEFE customer portal PR #42. Signed artifacts and source tests do not prove a secure release path. Stripe/billing is separate from GAIZ2 development.

## Automatic actions that are safe
- On each PR update: dependency-free negative-case suites, Node test suites, pinned synthetic TO fixture conformance, lint/typecheck, dependency audit, and disposable PostgreSQL RLS/replay/concurrency acceptance.
- Automatically fail on absent artifacts or missing reports; never convert a missing CI result into success.
- On successful PR checks, report evidence and ready-for-independent-review status. The check itself grants **no** human approval or security authorization.
- Automatically block production build/release if a module, endpoint or custodian becomes publicly reachable before reviewed integration and consent controls are complete.

## Explicitly never auto-approve
1. Custody grant signature, replay claim or a local policy result does not authorize decrypt/unwrapping.
2. KMS/HSM release must verify live workload identity and tenant/key entitlement, grant consumption, key revocation and key version in an authoritative atomic operation and log the outcome.
3. Recipient key lifecycle transition requires an independent registrar, tenant RLS, row locks, revision compare-and-swap and immutable audit. The pure planner is not the DB registrar.
4. Human-import approval must come from a distinct authorized person, be persisted and rechecked by an isolated executor. No CI or agent may impersonate the approver.
5. Security review, protocol freeze, production migrations, access policy, PR approvals, merge and rollout are release gates—not automatic actions while critical blockers remain.

## Current additions
- `gaiz2-key-release-eligibility.mjs`: fail-closed pure candidate check; result `kmsReleaseAllowed:false`.
- `gaiz2-recipient-key-lifecycle.mjs`: terminal revocation and tenant/version/revision-bound transition plan; result `kmsReleaseAllowed:false`.
- `gaiz2-recipient-key-registry-REVIEW-ONLY.sql`: unexecuted design proposal; no role or policy provisioning.
- Test suites wired into the existing PR source-guards CI job. These do not establish real KMS or PostgreSQL integration.

## Remaining acceptance
1. Ratified TO GAIZ2 wire format and pinned independent non-Node fixture, complete issuer trust/rotation/revocation semantics.
2. Provision real independently authenticated KMS/HSM custody and short-lived worker identity, with zero application-owned private keys.
3. Implement authoritative database key registry, strict RLS, immutable release ledger, one-use consumption and atomic revocation enforcement.
4. Complete independently verified quarantine, transactional import executor and distinct recorded human approval.
5. Expose reviewed TEBE endpoints behind authorization, bind TEFE to those endpoints, and complete EN/AR/RTL browser flows.
6. Pass negative-case + multi-tenant + concurrent PostgreSQL + KMS outage/revocation + actual TO-to-TEFE end-to-end acceptance, independent security review, and explicit release signoff.

**Not authorized:** production activation, real key release, live customer import, automatic security approvals, or merging this draft.
