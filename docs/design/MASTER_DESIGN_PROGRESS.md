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


## Design follow-through — 8 November 2026 (screen-level revision)

### Real customer-facing frontend refinements
Seven existing authenticated screens have review-only presentational enhancements, preserving their existing API loaders, role/module gates, record identifiers, links and real actions:
- `apps/web/src/app/(app)/decision-cockpit/page.tsx` — ranked source-linked decision cards; rule-based, no predictive claim.
- `apps/web/src/app/(app)/projects/page.tsx` — scoped KPI strip derived from returned project records, explicitly not necessarily portfolio totals.
- `apps/web/src/app/(app)/portfolios/page.tsx` — program and portfolio coverage summary from authorized API data.
- `apps/web/src/app/(app)/governance/page.tsx` — gate readiness, no new approval action.
- `apps/web/src/app/(app)/approvals/page.tsx` — pending versus signable legend with link to existing stage gates.
- `apps/web/src/app/(app)/reports/page.tsx` — report inventory and generated-state summary, retains original export endpoints.
- `apps/web/src/app/(app)/documents/page.tsx` — evidence/document summary; existing SharePoint and document access untouched.
- `apps/web/src/app/globals.css` — responsive design-context and decision-card surfaces using existing dark/light, RTL and semantic tokens.

### Offline visual inspection package
`docs/design/customer-showcase.html` is a separate *seven-screen* synthetic design study: executive overview, decision cockpit, portfolios/projects, approvals/governance, documents/reports, vendor operations, and proposed AI-agent control center. The standalone HTML has a theme switch, RTL geometry switch, screen navigation, local synthetic filter and disabled privileged controls. It has no customer API access. Download/open locally to inspect; this file is **not** a deployed or authenticated production route. The real operations-preview remains development-only and capability-gated.

Gallery static inspection (on the committed file, source checks only): seven tabs correspond to seven views; viewport metadata present; responsive CSS at 1160/860/620/375 px; light/dark and RTL geometry controls present; prominent synthetic labeling; no network/request API invocation; no HTML forms; nine disabled controls. These are source checks, **not** proof of actual browser rendering, WCAG conformance or Arabic translation. The gallery's RTL toggle checks layout direction, not a fully localized Arabic content experience.

### GitHub Actions CI evidence
- TEFE PR #19 marketing workflow: **PASS** (run 42452762865).
- TEBE PR #442 run **42455007874** on app-style commit: overall **FAIL**.
  - Dependency-free source guards: PASS.
  - Workspace packages build, TypeScript check, tenant isolation, data integrity, authenticated billing/workspace-switch isolation, financial PostgreSQL RLS: those named CI steps PASS.
  - Test stage: FAIL — 101 passed, 8 failed, 20 skipped. Seven failures in Microsoft integration tests when the Microsoft provider is unconfigured; one failed financial import permission test expected HTTP 403 but received 400. Investigate these as security-sensitive, not waived.
  - Dependency audit: FAIL — 67 findings (2 critical, 25 high, 31 moderate, 9 low) reported. The reported vulnerabilities must be triaged in a separately authorized dependency/security update.
  - CI acceptance evidence gate: FAIL after test failure.
- Browser behavior on the newly committed `customer-showcase.html`, visual snapshots at 1440/768/390, automated WCAG, TEBE end-to-end regression, and product shell localization: **UNVERIFIED** until inspected in a suitable browser environment. Do not equate CSS breakpoints with responsive test passes.
- No manual deploy, main merge, Cloudflare/DNS or backend/DB source edits. The draft PR remains the review boundary.

### Final review instructions
- Public site: https://github.com/2029TEFE/TEFE/pull/19
- Customer/admin: https://github.com/2029TEBE/TEBE/pull/442
- Offline galleries: `TEFE/docs/design/showcase.html` and `TEBE/docs/design/customer-showcase.html` on their respective review branches.
- For real UI verification, download the galleries and inspect at 1440, 768 and 390 px, theme modes and RTL; independently run authenticated app build and security checks. Do not merge while TEBE CI is failing.
- Reversion: close draft PR or revert the relevant review-only commits. Production is unchanged.

### Baseline CI comparison (pre-existing blockers)
The unmodified `main` baseline SHA `6471523278521b22ac63a41785ddd084e5d86a4f` also failed GitHub Actions [run 42010586057](https://github.com/2029TEBE/TEBE/actions/runs/42010586057) on 2026-11-05:
- The baseline's audit output also shows **67 vulnerabilities**, with the same 2 critical / 25 high / 31 moderate / 9 low severity distribution.
- The baseline's verify job also failed exactly **8 tests** in the same two files (`tests/microsoft.test.ts` and `tests/p0-financial-ai-privacy.test.ts`) and had a failed acceptance-evidence step.
Thus these *observed CI blockers pre-date this design PR*, although the safety implications remain and must be resolved separately before any merge or release. This comparison does not prove all modified UI runtime behavior correct.

## Follow-through v3.2 — executive overview / Studio / vendor safety (8 November 2026)
- `apps/web/src/app/(app)/page.tsx`: read-only executive journey showing overdue register items, blocked stage gates and the count of returned attention records. All values originate from existing `api.overview()`. The current cockpit review link was preserved. This is not a prediction, approval or cross-tenant metric.
- `apps/web/src/app/(app)/studio/page.tsx`: read-only four-item configuration summary (automation inventory, active automation count, custom fields, gate templates) from existing `api.studio`, keeping all underlying tables.
- `apps/web/src/app/(app)/super-admin/page.tsx`: bilingual operational safety and audit context before existing real plan/license forms; session and `pmoa_platform` checks and API endpoints unchanged.
- `apps/web/src/app/globals.css`: responsive RTL-logical three-step journey, 4/2/1 studio metric layout and status-word typography; both original themes retained.
- New static source checks: **15/15 PASS** — API loaders and source-bound values, existing route links, studio source data, admin auth and platform capability guards, original license forms, bilingual text, dev-only operations route, licensed nav filtering, CSS tokens/responsiveness and no additional direct API mutation.
- The latest GitHub run was still **in progress** when the source checks were recorded. [Follow current CI](https://github.com/2029TEBE/TEBE/actions).
- Prior TEBE PR CI: TypeScript/tenant isolation/database checks passed, while full suite and audit failed. Those same eight test failures and 67 dependency findings were observed on unmodified `main`; they are **pre-existing**, not waived. Separate authorized security/dependency remediation is required before release.
- **Unverified on this revision:** real authenticated browser rendering, WCAG AA, live EN/AR regression, screenshots and actual network/tenant permission tests of new UI. Synthetic offline gallery is not production validation.
- PR #442 remains open, draft, unmerged and undeployed; no database/API, CI, hosting or production files modified.

## Scheduled dual-frontend check — accessible customer tables (2026-11-08)
- Further read-only responsive/a11y improvement committed to TEBE draft PR #442. Added keyboard-focusable, labelled horizontal-scroll containers around six existing native HTML tables across five authenticated screen files: `approvals`, `governance`, `reports`, `documents` and both `studio` tables. Original rows, column values, status badges, links, exports, record loaders and guarded routes remain inside the native tables.
- `apps/web/src/app/globals.css` adds responsive 760px minimum table width only on narrow screens, focus outlines, scrollbar guidance and print overflow fallback. Horizontal scroll is contained inside each table, not the full page.
- GitHub source read-back QA: **5/5 files** have one accessible scroll wrapper per native table; **6/6 table/wrapper pairs** balanced, including the two Studio tables after correcting their independent region nesting. Every wrapper carries `role="region"`, a translated `aria-label`, and `tabIndex={0}`.
- This is **source-level accessibility work**, not a WCAG certification, screenshot check or browser test. Confirm real table keyboard scroll, Arabic RTL initial scroll position, mobile 390px behaviour and print layout in a local browser.
- Source changes do not alter security boundaries, permissions, user actions, main, backend, database, infrastructure, dependencies or workflow configuration. Existing TEBE baseline security/dependency test failures remain an independent release blocker.
- Latest GitHub Actions run for this source revision was pending when checks were recorded: https://github.com/2029TEBE/TEBE/actions/runs/42458646761 . Do not mark it passed until GitHub reports completed success.

## Design follow-up — decision/analytics responsive tables (2026-11-08)
- Added accessible `design-table-scroll` regions to two native tables in `decision-cockpit/page.tsx` and two native tables in `analytics/page.tsx`, using the previous shared focus, overflow and print styles. Underlying real data, links, rows, calculations, source-loader and authorization paths are unchanged.
- Source read-back QA: **4/4 table/wrapper pairs balanced**; both pages have two keyboard-focusable regions, each with a localized accessible name. Existing decision-cockpit section has a separate `aria-label` (the full page has three labels, only two are table regions). No runtime browser claim.
- GitHub CI run [42460954603](https://github.com/2029TEBE/TEBE/actions/runs/42460954603) was in progress on the code revision when noted. Prior run [42458690011](https://github.com/2029TEBE/TEBE/actions/runs/42458690011) finished with existing audit and integration failures; TypeScript, build and tenant-isolation steps passed. Baseline main was previously found to have same eight tests and 67 dependency findings. No bypass, merge, deploy or backend changes.

## Review iteration v3.5 — Mobile reading and table navigation (2026-11-08)
- Added five labelled, keyboard-focusable horizontal-scroll containers around five **existing native tables** in three read-only authenticated pages: `(app)/page.tsx` (executive needs-attention); `(app)/my-work/page.tsx` (approvals, outstanding criteria, tasks); `(app)/raid/page.tsx` (risk/issue register).
- Source verification on GitHub read-back: **5/5 native table wrappers and closing elements balanced**, each `role="region"`, translated label via existing `t()`, and `tabIndex={0}`; original `Loaded` API loader remains on all three pages. Shared `design-table-scroll` CSS was added in previous design iteration and reused; no new infrastructure or dependency.
- Last complete TEBE workflow on preceding head: [42461031380](https://github.com/2029TEBE/TEBE/actions/runs/42461031380), failed with prior project baseline: package/types and tenant isolation success, integration/security tests and package audit failure. The new head may have an additional GitHub Actions run; do not mark it successful until complete.
- New wrapper source assertions do **not** establish actual browser, RTL, responsive, screen-reader, WCAG or authenticated E2E test passes. Those checks remain pending.
- Design-only, reviewed on draft PR #442. Existing security checks / auth/tenant isolation must not be bypassed. No backend, database, Cloudflare, billing, CI config, production deployment or merges.
