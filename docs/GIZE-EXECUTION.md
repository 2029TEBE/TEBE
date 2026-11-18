# GIZE execution charter

This repository owns its own tasks and GitHub issue. Read [GIZE-CHECK.md](../GIZE-CHECK.md) on each run.

## TEBE scope
Backend APIs, identity and tenant isolation, locale propagation, data and migrations, secure integration, production deployment.

## Initial task register (provisional until source archive is indexed)
- [ ] BE-001 Inventory APIs, auth, migrations, services and production environment
- [ ] BE-002 Verify FE↔BE and TO↔BE protocol contracts
- [ ] BE-003 Audit GIZE naming and legacy file/wire format compatibility
- [ ] BE-004 Validate multi-tenant isolation, encryption and key custody, error localization
- [ ] BE-005 Verify backend production health, deployment, rollback and tests

## Work rules
- Use source-backed, uniquely identified requirements and small, independently reviewable PRs.
- Cross-check GitHub issues and code; never report presumed completion.
- Update progress after meaningful changes and daily while actively working.
- Keep source archive out of ordinary Git history; preserve protected access and checksum in TO.
- Production go-live requires passing checks, secure integrations, multilingual verification, deployment evidence and documented rollback.
