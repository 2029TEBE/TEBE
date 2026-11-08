# THEEPMO — Master Design Progress
Updated: 2026-11-08 · Task 1/5 · design-only audit
## Verified baselines
- TEFE `2029TEFE/TEFE` main `bafd70795b2e082b01760cfc93eb6abab17e7108`.
- TEBE `2029TEBE/TEBE` main `6471523278521b22ac63a41785ddd084e5d86a4f`.
- Review branches only: `design/bulk-website-visual-upgrade` and `design/bulk-app-admin-visual-upgrade`.
- GitHub source inspection completed. Local builds, browser screenshots, visual regression, WCAG audit, and security regression: **UNVERIFIED / NOT RUN**.
## Selected direction
**Executive hybrid:** bright public marketing, theme-aware customer workspace, visually distinct vendor operations. Alternatives considered: all-light enterprise (less cockpit differentiation), all-dark premium (reduced public readability). No backend changes. Brand remains THE EPMO.
### Design tokens
| Concept | TEFE marketing | TEBE customer |
|---|---|---|
| Deep navy | #0B2630 | #0B2630 reference, existing dark CSS tokens preserved |
| Teal | #087F80 | existing theme-aware `--accent` (#51cbb9 dark) |
| Amber | #D7A94B | existing `--warn` (#e3b341 dark) |
| Paper | #F5F7F9 | existing light `--bg` (#f4f7f9) |
| White | #FFFFFF | existing light `--surface` (#ffffff) |
| Spacing | 4/8/12/16/24/32/40/48 px | `--sp-1..12` in globals.css |
| Radius | 10–20 px | `--r-sm` 11px, `--r` 16px, `--r-xl` 28px |
| Type | Inter/system, clear executive hierarchy | Manrope and Noto Kufi Arabic, existing theme |
| Semantics | explicit success/caution/critical/info | existing `--good`, `--warn`, `--crit`, `--info` |
Use CSS logical properties and document-level `dir` for Arabic. Keep theme preference key `pmo-theme-v2`; never silently overwrite existing user settings. A shared *spec*, not a shared runtime dependency.
## Source-backed inventory
| Surface | Current source | Classification | Task | Evidence |
|---|---|---|---|---|
| TEFE home | index.html, styles.css, app.js | existing static bilingual marketing | 2 | source inspected; screenshot pending |
| TEFE analytics | analytics.css, analytics.js | interactive illustrative demo, not live telemetry | 2 | source paths verified |
| TEFE features/pricing/FAQ | features.html, pricing.html, faq.html, pages.css | existing static pages | 2 | source paths verified |
| TEFE policies | privacy.html, terms.html, accessibility.html | existing static pages | 2 | preserve text |
| TEFE showcase | docs/design/showcase.html | synthetic review-only HTML prototype on branch | 2 | GitHub path verified |
| TEBE shell | apps/web/src/app/(app)/layout.tsx | existing session-aware React layout | 3 | source inspected |
| TEBE overview/cockpit | (app)/page.tsx, decision-cockpit/page.tsx | existing API-connected UI; runtime unverified | 3 | source paths verified |
| TEBE projects/portfolio | projects/page.tsx, portfolios/page.tsx | existing real UI; runtime unverified | 3 | source paths verified |
| TEBE approvals/governance | approvals/page.tsx, governance/page.tsx | existing guarded UI | 3 | source paths verified |
| TEBE reports/docs | reports/page.tsx, documents/page.tsx | existing UI | 3 | source paths verified |
| TEBE vendor | super-admin/page.tsx, studio/page.tsx | existing licensed administration | 4 | source paths verified |
| TEBE ops prototype | operations-preview/page.tsx, preview.css | synthetic, development-only design study | 4 | GitHub path verified; runtime unverified |
## Route inventory
TEFE: / (index), /features.html, /pricing.html, /faq.html, /privacy.html, /terms.html, /accessibility.html. Showcase: /docs/design/showcase.html (local source file, not a deployed route).
TEBE authenticated: /, /my-work, /activity, /getting-started, /projects, /portfolios, /board, /planner, /governance, /governance/[projectId], /raid, /decisions, /approvals, /analytics, /financials, /benefits, /resources, /notifications, /data, /power-bi, /reports, /reports/board-pack, /documents, /updates, /stakeholders, /studio, /integrations, /settings, /platform, /billing, /super-admin, /ask, /decision-cockpit. Local development-only /operations-preview. Public/auth routes include /login, /forgot-password, /reset-password, /accept-invite.
## Security/behavior preservation
- Existing TEBE app layout redirects unauthenticated sessions to /login, including expired-session explanation.
- Navigation uses `can(caps, cap)` AND `NAV_MODULE` license filtering. This is visual convenience, not API authorization.
- Existing API routes, NestJS, PostgreSQL/RLS, shared contracts, billing, and tenant switching must remain unchanged.
- Vendor concept requires an authenticated session and `pmoa_platform` capability and calls `notFound()` outside development. This is *not* production authorization evidence.
- Synthetic figures are clearly labeled; no production credentials or customer fixtures.
## Components and review targets
Rail/topbar, breadcrumbs, command palette, KPI tiles, filters, table, badge, tab, dialog, form, skeleton, alert, empty/error/forbidden state, workflow node, admin confirmation, AI prompt. Test light/dark and 1440/768/390, keyboard focus, English/Arabic RTL. Document actual test results, never infer from source.
## Delivery checklist
| Task | Scope | Status |
|---|---|---|
| 1 | source audit, token spec, inventory, deferred decisions | documentation committed; runtime checks not run |
| 2 | TEFE pages and interactive visual showcase | in progress on review branch |
| 3 | TEBE customer app visual polish | in progress on review branch |
| 4 | vendor operations concept | prototype committed; runtime unverified |
| 5 | QA, before/after gallery, review-only PRs | pending |
## QA evidence
| Check | Status |
|---|---|
| Both main commit SHA checks | PASS — GitHub metadata |
| Source route and navigation inspection | PASS — GitHub source |
| Review-only branch file persistence | PASS for previously queried files; docs verified after commit |
| Next.js typecheck/build | NOT RUN |
| TEFE browser functionality | NOT RUN |
| Responsive screenshots 1440/768/390 | NOT RUN |
| RTL/light-dark accessibility audit | NOT RUN |
| Security and tenant isolation regression | NOT RUN |
| CI and deploy workflows | NOT TRIGGERED by this task |

## Workstreams 3–5 final review (2026-11-08)
- Workstream 3: presentation-only customer app styling in `apps/web/src/app/globals.css`: stronger keyboard focus, compact responsive KPI grid, logical RTL alignment and overflow resilience. Existing API-bound pages and their behavior were not rewritten.
- Workstream 4: authenticated, development-only `operations-preview` extended with illustrative entitlements, human approval journey and audit concept. Fixtures are explicitly synthetic; all simulated mutations disabled. No actual agent, license or tenant API integration.
- Workstream 5: source comparison against main and file-by-file scope inspection performed via GitHub. Both review branches remain ahead of main without backend changes in their compare file inventories. No browser session, local Next.js dependency tree, test runner or screenshot tool was attached to this GitHub-only run. Thus no runtime claim is made.
### Evidence matrix
| Check | Result | Evidence |
|---|---|---|
| Branch compare vs main | PASS | GitHub compare metadata; changed-path inventory |
| Vendor development-only guard | PASS (static source) | `NODE_ENV !== 'development'` calls `notFound()` |
| Vendor capability check | PASS (static source) | `session.capabilities.includes('pmoa_platform')` |
| Synthetic/no-mutation labels | PASS (static source) | page copy and disabled buttons |
| No backend/Cloudflare files changed | PASS (compare paths only) | GitHub compare inventory |
| Next.js typecheck/build | UNVERIFIED | No local checkout or installed dependencies |
| Browser behavior and responsive 1440/768/390 | UNVERIFIED | No rendered screenshots |
| EN/AR RTL and dark/light | UNVERIFIED | CSS reviewed, not rendered |
| WCAG, tenant/RLS and security regression | UNVERIFIED | No test environment |
| CI execution | UNVERIFIED | No workflow result read |
### Review guidance
Open the GitHub branch files for `apps/web/src/app/(app)/operations-preview/page.tsx`, `preview.css` and `apps/web/src/app/globals.css`. A real UI preview requires an authorized local development environment with a session containing `pmoa_platform`. This is intentionally not accessible in production.
### Rollback
Revert the branch-only commits, or close the draft PR; do not merge until independent browser/security review. No production rollback is needed because nothing was deployed.
