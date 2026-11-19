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


## SOURCE-LINKED CHECKLIST — authoritative on every run (2026-11-18)
**Command:** `gize tebe`

[Open the repository's source-linked full requirement checklist](https://github.com/2029TEBE/TEBE/blob/main/docs/GIZE-SOURCE-CHECKLIST.md). Cross-check each ID against full wording in the controlling `Theepmo ref2.md`; do not infer detailed requirements from short labels. Verify code, PRs, tests, security, deployed SHA and cross-repo integration. Update checkboxes and linked issue only on real evidence. Flag failing tests and security findings; propose safe grouped fixes and log blockers. Routine checks can run whenever an authorized agent is invoked; Markdown alone cannot schedule anything.

**Cross-repository audit:** command `gize the epmo` -> [GIZE master 150-ID register](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/GIZE-MASTER-150-REGISTER.md) and [master audit instructions](https://github.com/faisalwrokksa-hub/TO/blob/main/GIZE-THE-EPMO-AUDIT.md).

**Release authorization update (CHANGE-20261119-3):** The owner has now explicitly authorized autonomous code changes, eligible routine merges and deployment **attempts** within the existing passing CI, host identity, security/RLS, backup/rollback and exact-revision readback gates. Optional independent PR review is not required when GitHub itself does not require it. This is **not** blanket paid-customer GO, payment/merchant activation, destructive database approval, privileged tool execution, or permission to bypass GitHub rules. Full product-specific production/customer acceptance and any independent approvals enforced by repository policy remain binding. Record actual live SHA and endpoint evidence; if absent, keep customer release NO_GO.


## Mandatory per-task completion and owner changes (2026-11-18)
**Read on EVERY command run:** [Owner instructions](docs/GIZE-OWNER-INSTRUCTIONS.md), [full source-text checklist](docs/GIZE-SOURCE-CHECKLIST.md) and [controlling 150-item source](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md).

When each individual task is completed, reclassified or blocked, update its exact ID in `docs/GIZE-SOURCE-CHECKLIST.md` **immediately**, attach source code path/PR/SHA, tests/security results, deployment proof where required and UTC time, and add a comment to the repository's canonical progress issue. Take owner re-instructions from `gize tefe: ...`, `gize tebe: ...`, `gize ot: ...` or issue comments, preserve them in `docs/GIZE-OWNER-INSTRUCTIONS.md`, then reconcile affected IDs and cross-repo contracts. Never mark work complete without independent evidence.

**Permanent source:** five readable reference documents reside in TO; complete original ZIP is preserved as [11 numbered parts in a private Drive folder](https://drive.google.com/drive/folders/1ANtZI7siXicrqqAb0-WIwaOFjLcdSccC), with [reconstruction/hash instructions](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/RECONSTRUCT-AND-VERIFY.md). Expert access and downloaded remote bytes still require verification; the source upload is not an implementation signoff.
