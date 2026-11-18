# GIZE — CHECK AND CONTINUE
Version: 1.0 | Updated: 2026-11-18
## Purpose
This small file is a reusable entry point. A human expert or AI agent can read it to discover the repository-specific task register, check actual work against committed code, and continue unfinished work **without repeatedly uploading the original archive**.

## First actions on every run
1. Read this file and `docs/GIZE-EXECUTION.md` in the current repository, and the corresponding files in the other two repos: `2029TEFE/TEFE`, `2029TEBE/TEBE`, and `faisalwrokksa-hub/TO`.
2. Read the associated `GIZE Expert Execution` GitHub issue and its latest comments, PRs, workflows, deployment evidence and branch state. Don't rely on self-reported status.
3. Locate the registered source package in the master TO issue. Verify its checksum and manifest. If missing, mark **SOURCE BLOCKED**: do not invent requirements from an unseen ZIP.
4. Build/reconcile task register: stable IDs `FE-###`, `BE-###`, `TO-###`; for each record: requirement/source path, owner/repo, acceptance criteria, status, PR/commit, CI, deployment proof, blockers and last-reviewed UTC date.
5. Verify every claimed completion against the actual diff, automated tests and running service. Categorize `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `IMPLEMENTED/UNVERIFIED`, `VERIFIED`; do not equate merged with deployed.
6. Pick the highest priority unblocked task in **this** repository, implement on a branch, test, open a PR for review, then update the issue and register with evidence. No bypassing required reviews or security checks.
7. Post issue update after each meaningful change and at least every active working day: UTC time | completed | remaining | blocked | next | PR/commit | tests | deployed version.
8. Flag cross-repository contract changes in the master TO issue with the other expert issue links.

## Naming and safety
Product name is **GIZE**. Audit legacy `GAIZ`, `.gize`, and product-facing `Encryption` labels, but **do not blindly rename encryption mechanisms, keys, wire formats, migrations or publicly consumed identifiers**. Use safe, compatible migration plans.

## Source archive handling
The uploaded `execute fully.zip` is approximately 430 MB and has **not yet been verified as persisted in GitHub**. GitHub Contents API cannot store this as a normal file. Use a private GitHub Release asset, Git LFS or other access-controlled versioned storage after vetting for secrets and binary size. Store the immutable link, SHA-256, inventory/manifest and ownership mapping in TO. Never commit secrets or bulky generated files to ordinary Git history.

## Evidence / acceptance rules
Only mark `VERIFIED` with a linked code commit, passing relevant checks, a reviewer disposition and deployment verification if deployment is required. If access or tooling is missing, record the blocker and give the exact human action needed. Experts may update asynchronously through GitHub, but merely uploading this MD file will **not itself run code**: a GitHub Action, agent or manually invoked task must read and execute it.
## TEBE scope
Backend APIs, identity and tenant isolation, locale propagation, data and migrations, secure integration, production deployment.

## Initial task register (provisional until source archive is indexed)
- [ ] BE-001 Inventory APIs, auth, migrations, services and production environment
- [ ] BE-002 Verify FE↔BE and TO↔BE protocol contracts
- [ ] BE-003 Audit GIZE naming and legacy file/wire format compatibility
- [ ] BE-004 Validate multi-tenant isolation, encryption and key custody, error localization
- [ ] BE-005 Verify backend production health, deployment, rollback and tests
