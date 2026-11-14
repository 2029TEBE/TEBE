# Agent instructions — THEEPMO application (an Orgaiz product)
Read the cross-repository [Orgaiz brand architecture](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/BRAND_ARCHITECTURE.md) when available on main. This is the local rule set while cross-repo documentation is reviewed.

## Product and brand
- **Orgaiz** is the master brand and main public website, intended for Orgaiz.com.
- **THEEPMO** remains the enterprise application/product: governance, strategy, portfolios, projects, approvals, analytics and executive reporting. It is not a separate corporate or marketing brand.
- Exactly **two customer-facing web experiences**: Orgaiz public/tools and authenticated THEEPMO. No separate TheOrg site or third marketing frontend.
- The planned encrypted-file extension is exactly **`.gaiz`**, lowercase.

## Repository scope and invariants
- Owns `apps/web` authenticated frontend, `apps/api` NestJS API, contracts, Postgres data and tenant isolation.
- TEFE owns currently deployed legacy public marketing assets pending Orgaiz consolidation; TO owns the legacy TheOrg/Orgaiz AI-agent/Chrome/Windows runtime.
- Preserve server-enforced tenant authorization, database RLS, role/module entitlements, approval/stage-gate checks, append-only audits, Arabic/RTL and existing real functionality.
- Do not treat cosmetic UI changes, names, or domain choices as authorization to move or copy customer databases, change production authentication, or modify RLS.

## Proposed shared connections
- BYOAPI provider secrets stay encrypted server-side and bound to tenant/owner, with audit, rotation/revocation and no exposure to browser/logs.
- Orgaiz-managed access uses platform tokens, enforced tenant spend ceilings and upstream credentials retained by the platform; no reselling raw provider keys.
- Do not advertise encryption, SSO, managed billing or API integrations as released until implemented and tested.

## Change/release controls
- Documentation-only work must not modify migrations, RLS, CI/CD, production data, deployments, Cloudflare/DNS, credentials, charging or API permissions.
- Use reviewed PRs with tests for any future behavior changes; preserve existing THEEPMO app URLs until migration accepted and separately authorized.
