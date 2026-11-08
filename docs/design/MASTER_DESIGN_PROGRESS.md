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

## Review iteration v3.6 — Shared and financial table keyboard access (2026-11-08)
- `apps/web/src/components/DataTable.tsx`: added a keyboard-focusable `role="region"` and an explicit localized accessible label to its existing `scrollx` container. The native sortable/filterable table, headings, row counts, filtering, sorting and cell renderers are unchanged. The shared component is reused across customer pages, so this improves the shared table rather than duplicating page-specific wrappers.
- `apps/web/src/app/(app)/financials/page.tsx`: the existing By Project horizontal-scroll container now has a translated accessible label and keyboard focus. By Category native table has its own labelled `design-table-scroll` region. Financial calculations, API response and UI actions are unchanged. No new access to financial data.
- `apps/web/src/app/globals.css`: added focus-outline, inline overscroll containment and print overflow fallback for the existing reusable `scrollx` region.
- Source read-back assertions: **10/10 passed** covering native table preservation, existing sorting/filter callbacks, localized labels, accessibility hooks, both financial tables, existing calculation paths and focus/print CSS. These are static checks only; authenticated mobile and screen-reader testing remains unverified.
- The unchanged TEBE `main` branch had the same eight failing tests and 67 dependency-audit findings previously recorded. Do not interpret static design checks as a waiver of current GitHub Actions failures. No merge/deploy; only draft PR #442.

## Design follow-up v3.7 — shared sortable table semantics (8 November 2026)
- `apps/web/src/components/DataTable.tsx`: add `scope="col"` to generated header cells, `type="button"` to the table sort and clear-filter controls, and `aria-hidden="true"` to the visual sort-arrow glyph. Existing `aria-sort`, sort callback, filter state, native table, keyboard-scroll region, source data and localization remain unchanged.
- Verified through branch source read-back: **9/9 static checks pass** for semantic headers, decorative glyph isolation, non-submitting button types, sorting/filter preservation, ARIA sort, focusable region and table retention.
- These checks do **not** replace real keyboard/screen-reader, WCAG, English/Arabic RTL, authenticated E2E, screenshot or browser testing.
- No backend, permissions, tenant isolation, dependency, API, billing, infrastructure, CI config, main branch or production changes. Pre-existing full-suite and dependency audit failures remain release blockers.

## Design follow-up v3.8 — translated table sorting action names (2026-11-08)
- Enhanced `apps/web/src/components/DataTable.tsx` sortable header buttons with `aria-label` text that explicitly announces **Sort by [column]** in English and **ترتيب حسب [العمود]** in Arabic. Existing `aria-sort` on the native table heading remains authoritative for direction and state.
- Read-back source checks passed **4/4** for translated action labels, existing sort ARIA and callback, filter/search preservation and native table retention (combined cross-repo source assertions **11/11**).
- Latest GitHub Actions run for the code revision `53a640ad322db3caa5dfaad6997aff35b3726198`: [42467450759](https://github.com/2029TEBE/TEBE/actions/runs/42467450759) (in progress when inspected). Earlier runs still failed the integration/security test and package audit jobs; these were previously observed on unchanged main. Do not waive or merge with failing CI.
- No backend, RLS, data mutation, access control, dependencies, production release or workflows changed. Actual browser accessibility, RTL geometry, authenticated testing and WCAG checks remain **unverified**.

## Design follow-up v3.9 — authenticated module Arabic labels and mobile tables (2026-11-08)
- Four existing authenticated UI pages now show explicitly bilingual presentation for selected headings, statuses and help content: `benefits` (benefit status, decrease-is-better indicator and baseline-to-target progress text), `resources` (workload over-allocation indicator), `stakeholders` (handling bands, external status and explanatory matrix text), and `decisions` (decision register, unassigned and not-gate-linked labels). Existing input forms, business rules and API calls stay unchanged.
- Wrapped **five native HTML tables across four pages** in localized, named, keyboard-focusable `design-table-scroll` regions. Reused existing shared mobile/RTL/print CSS without modifying data or tables.
- GitHub read-back static audit: **4/4 pages** retain original API loads, calculation/source markers and labels, and **5/5 table regions** have matched starts and closing tags; original input forms remain on the three record-creation pages.
- No full authenticated browser, 390px overflow, RTL scroll initial position, translation completeness, assistive-tech or WCAG-AA audit was run. Do not infer runtime support or complete localisation from this source review.
- [TEBE review PR #442](https://github.com/2029TEBE/TEBE/pull/442) remains draft, unmerged and undeployed. Previous independent CI audit and integration/test failures on main remain hard release blockers; do not waive or alter backend, RLS, payments, dependencies or CI in this design branch.

## Design follow-up v4.0 — bounded visual progress fills (2026-11-08)
- Four authenticated customer pages updated, without modifying source records, actual numeric labels or business logic:
  - `(app)/financials/page.tsx`: committed-spend, actual-spend and category drawdown bars now guard zero/invalid budgets and clamp display width to 0–100%.
  - `(app)/benefits/page.tsx`: benefit progress fill stays within its container even when the *real* percent exceeds 100%. The numeric percent remains visible and unchanged.
  - `(app)/page.tsx`: average completion and budget-drawn visual bars bounded; original overview totals and decision actions preserved.
  - `(app)/resources/page.tsx`: capacity fill bounded without hiding actual over-allocation percentage/warning.
- Decorative bar fills use `aria-hidden="true"` because adjacent numeric labels report the full metric without visual truncation.
- GitHub source read-back passed for **4/4 files, 7/7 updated bar usages**, guards for non-finite values, and retention of existing API loaders/actions. A pure mathematical helper check covered **8 edge scenarios** (zero/negative budget, over-budget, normal, negative actual, NaN, over-target benefit, negative benefit); it was not a compiled or browser unit test.
- CI is tracked separately. Existing TEBE full-suite and dependency-audit release blockers must not be bypassed. Authenticated 390px/browser/RTL/WCAG checks remain unverified; no deployment or merge.

## Design follow-up v4.1 — portfolio health i18n and workbook table navigation (2026-11-08)
- `apps/web/src/app/(app)/portfolios/page.tsx`: the portfolio list is now wrapped in a native, explicitly EN/AR-labelled keyboard-scroll region. Visible health terms use localized Arabic translations (`وفق الخطة`, `يحتاج انتباها`, `حرج`) while original enum values and existing health CSS classes are preserved.
- `apps/web/src/app/(app)/data/page.tsx`: the workbook schema reference table retains its original columns and schema-driven contract labels. Its existing `tablewrap` now also uses the shared `design-table-scroll` class plus a localized accessible name and keyboard focus; the import/export API and upload process remain untouched.
- GitHub read-back checks verified **2/2 native tables and scroll regions**, `tabIndex={0}` and accessible labels, unchanged portfolio API source loaders and project-creation capability check, and unchanged workbook template/import component.
- Latest TEBE GitHub workflow for code head `f245be40ecf8c7078664d76bb9f3c18d3d2115ce` was in progress when checked ([run 42469359443](https://github.com/2029TEBE/TEBE/actions/runs/42469359443)). Earlier run [42469109552](https://github.com/2029TEBE/TEBE/actions/runs/42469109552) failed existing integration and dependency-audit checks. Do not mark current revision passed without GitHub confirmation.
- Actual authenticated browser testing, RTL scroll keyboard use, screenshot contrast and WCAG checks still required. No merge, deployment, backend, RLS, CI settings, database, Cloudflare or billing changes.

## Follow-through v4.2 — route-safe, accessible breadcrumbs (2026-11-08)
- `apps/web/src/components/Crumbs.tsx` now resolves navigation links at complete path-segment boundaries, avoiding false matches when routes share text prefixes (e.g. `/projects-extra` must never be treated as `/projects`). Root and true nested routes remain correctly handled.
- Breadcrumb markup is now a named landmark (`nav`, EN/AR accessible label); separators are decorative (`aria-hidden`) and the current item is explicitly marked with `aria-current="page"`.
- Two authenticated standalone pages not in `NAV` now get their correct EN/AR names: `/decision-cockpit`, `/operations-preview`. Unknown pages use an honest generic current-page label rather than incorrectly asserting Executive Overview.
- GitHub read-back static checks: **7/7 structural** assertions passed and **10/10 pure route-matching cases** passed; no compiled, authenticated browser, keyboard or screen-reader runtime certification is claimed.
- Existing capability-filtered navigation, route content, API calls, tenant isolation, production and backend remain unchanged. CI and release blockers are tracked separately; do not merge/deploy from this draft PR.

## Design follow-up v4.3 — focusable chart drill-down links (2026-11-08)
- Chart-only change in `apps/web/src/components/Chart.tsx`: stacked portfolio-health segments now render a real `a.seg` when a source drill-down URL exists, or a normal inert `span.seg` otherwise. This replaces the previous `<a style="display:contents">` pattern that could remove the visible focusable link box for keyboard and assistive technology users. Segment widths, colours, numeric data, negative/zero filtering, links and legends are preserved.
- Linked SVG bars in the existing `BarChart` now expose a grounded `aria-label` combining the category and formatted real source value, without changing visuals or source destinations.
- `apps/web/src/app/globals.css`: updated existing hover selector to target the direct anchor, and defined a visible inset keyboard focus treatment for the bar segments. No changes to APIs, access controls, business logic or back-end rendering.
- GitHub source read-back checks: **12/12 passed**, verifying actual links, inert non-links, original fill geometry and legends, aria labels, and CSS hover/focus selectors. Actual browser rendering, screen reader announcement, mobile click targets, RTL, contrast and end-to-end interactions remain unverified.
- Design changes reside only on existing draft PR #442, unmerged and undeployed. Do not treat static checks as release evidence; existing integration and dependency audit CI failures remain blockers.

## Design follow-up v4.4 — actual theme token for chart focus (2026-11-08)
- Reviewed the previous StackedBar keyboard focus CSS after GitHub CI check. Found a concrete styling defect introduced by v4.3: the focus rule used `var(--paper)`, but `--paper` does **not** exist in the app's stylesheet. This could invalidate the visible outline property.
- Replaced only that missing token with existing `var(--surface)`, defined in both dark and light theme palettes, while keeping `var(--ink)` for inset focus contrast. The semantic clickable anchors and their labels are unchanged.
- GitHub source read-back checks: **9/9 passed**, validating theme token definitions, focus contrast selectors, removal of the bad variable and preserved chart links/labels/widths. Actual screenshot contrast and browser keyboard testing remain unverified.
- Prior TEBE GitHub full-suite tests and dependency-audit fail; they remain mandatory release blockers, separate from this CSS-only fix. No API/backend/authorization/RLS/database/CI workflow or production changes; draft PR #442 remains unmerged.

## Design follow-up v4.5 — activity snapshot and notification outbox mobile access (2026-11-08)
- `apps/web/src/app/(app)/activity/page.tsx`: introduced an executive-grade three-card design snapshot using *only* the existing authorized `api.activity` response: returned items needing a decision, returned audit entries, and needing-decision items that have a due date. The panel explicitly describes counts as records returned by the current API response, not necessarily all history. Kept the existing audit trail, timestamps and full detail; no write operations.
- The Activity needs-a-decision table is now a native table within a localized EN/AR named horizontal-scroll region, keyboard focusable and backed by existing shared responsive/print CSS.
- `apps/web/src/app/(app)/notifications/page.tsx`: made the existing outbox `tablewrap` responsive by reusing `design-table-scroll`, adding a bilingual accessible name and `tabIndex={0}`. Did not modify send-rules action, message state, destination email, transport state, or notification data.
- Source verification after commit: **2/2 pages** preserve existing authorized API loaders and their native tables; **2/2 tables** have labeled keyboard-focusable regions, **3/3** activity summary values originate from returned records; audit diff and notification POST button remain in place.
- This is static source inspection, not real authenticated browser/E2E, responsive screenshot, visual contrast, keyboard or screen-reader proof. Existing test/audit CI blockers remain mandatory before release. Changes stay only in draft PR #442; no backend, RLS, tenancy, billing, Cloudflare, merge or deploy.

## Design follow-up v4.6 — accessible workspace settings tables (2026-11-08)
- `apps/web/src/app/(app)/settings/page.tsx`: applied the existing responsive, keyboard-scrollable `design-table-scroll` pattern to four **native HTML tables**: recent invitations, workspace details, members and current role capabilities. Each table has its own localized EN/AR region label and keyboard focus, keeping the invitation-section heading outside the scroll area.
- Localized the visible workspace-name label, database isolation status label and current role explanation into Arabic/English. Displayed current role now uses the existing `ROLE_LABELS` mapping with a type-safe fallback to the previous stored text. No change in role/capability permissions themselves.
- Github source read-back: **12/12 checks passed** for four balanced native table wrappers, bilingual names and keyboard focus; retained all three source API loaders, both permission gates, member/profile invite/revoke form actions, and true capability data.
- This is static source QA, **not** browser, screen-reader, 390px mobile/RTL, or customer data E2E testing. Source head before documentation commit `09243922fe8a423432e711c5ae74878011b938a1` has GitHub Actions [run 42471628542](https://github.com/2029TEBE/TEBE/actions/runs/42471628542) in progress at inspection. Earlier full-suite tests and dependency audit failed; do not claim merge readiness.
- All edits remain in draft review PR #442 only; no auth, backend, data mutation, billing, CI config, Cloudflare, merge or deployment changes.

## Design follow-up v4.7 — source-verified settings and CI typecheck correction (2026-11-08)
- Confirmed v4.6 settings updates preserve four native tables, all four EN/AR labeled keyboard-scroll regions, three existing API loaders, invitation/revoke POST forms, capability gates, and type-safe role label fallback. **12/12 source assertions passed** after GitHub read-back.
- Crucially, checking actual GitHub Actions logs for [run 42471628542](https://github.com/2029TEBE/TEBE/actions/runs/42471628542) identified a **new TypeScript regression** from the earlier v4.5 Activity snapshot, not just previously known audit/integration blockers: `apps/web/src/app/(app)/activity/page.tsx(32,44): error TS7006: Parameter 'item' implicitly has an 'any' type.`
- Corrected the Activity UI read-only due-date count callback with an explicit type `(item: { due?: string | null })`; source read-back confirms the original `api.activity` loader and audit feed are retained. This fixes the identified source-level issue but **must not be called a TypeScript pass** until the new GitHub workflow completes.
- Code-fix workflow: [42471802303](https://github.com/2029TEBE/TEBE/actions/runs/42471802303) was queued when checked. Existing dependency audit failures remain a hard release blocker, as do any outstanding tests. No CI bypass, main merge, production deployment, auth/backend/database or Cloudflare edits.

## Design follow-up v4.8 — localized, non-technical load failure (2026-11-08)
- `apps/web/src/components/Page.tsx` / shared `Loaded` component: changed the **generic API loading failure presentation only** to a concise EN/AR alert with safe, user-actionable reload/contact guidance. The previous developer-only `pnpm smoke` instruction and backend error-message echo no longer appear to customers in this generic state. Existing module-not-licensed (403/subscription), role-forbidden (403), blank-list states, page titles, API loads and normal child rendering are unchanged.
- Source read-back static verification **12/12 passed**, covering AR/EN copy, error alert, original license/role error conditions, no-data rendering, import correctness, original page headings/children and existing CSS error styling.
- **Important CI update:** [TEBE Actions run 42471857677](https://github.com/2029TEBE/TEBE/actions/runs/42471857677) on the preceding branch head confirmed TypeScript **SUCCESS**, tenant isolation **SUCCESS**, offline source checks **SUCCESS**; full integration tests **FAILURE** and package dependency audit **FAILURE** remain. The previous TypeScript regression in the Activity metric has thus been resolved in CI.
- [UI-fallback code workflow 42472060832](https://github.com/2029TEBE/TEBE/actions/runs/42472060832) is in progress at inspection. No authenticated browser/screen-reader/RTL testing is claimed. Draft PR #442 remains unmerged and undeployed; no permission, RLS, financial, data, CI, Cloudflare or infrastructure edits.

## Design follow-up v4.9 — Arabic workbook preview and project progress geometry (2026-11-08)
- `apps/web/src/components/ImportPanel.tsx`: localized the workbook preflight button, preview heading, success/failure guidance, sheet row counts and error fallback into Arabic/English. The preview still explicitly says it does **not** modify data, while retaining its warning that an eventual import may still fail authoritative server-side validation. All existing `/api/excel/preview`, `/api/excel/upload`, create/update, file input, conflict handling and no-JS POST paths are unchanged.
- `apps/web/src/app/(app)/projects/ProjectsTable.tsx`: constrained only the decorative project progress bar's displayed width to 0–100%, including invalid and over-target percentages. The original percentage shown alongside the bar, native table sorting/filtering, health severity sort and governance links are unchanged.
- GitHub source read-back **16/16 assertions passed**, including endpoint and write-flow preservation, bilingual UX, progress data preservation, and a pure mathematical review of invalid/under/over-range values. Source checks are **not** equivalent to a compiled/browser/E2E verification.
- Baseline CI before these changes: [run 42471857677](https://github.com/2029TEBE/TEBE/actions/runs/42471857677) confirmed Types, tenant isolation and offline checks pass, while full tests and package audit fail. Latest v4.8 UI workflow [42472168274](https://github.com/2029TEBE/TEBE/actions/runs/42472168274) had passed Types, tenant isolation and offline checks but full tests were still running and package audit failed when inspected. Recheck current head after commits.
- All modifications remain in draft [TEBE PR #442](https://github.com/2029TEBE/TEBE/pull/442). Do not merge or deploy. Authenticated Arabic RTL/mobile/screenshots/assistive technology tests remain unverified, and existing CI audit/integration blockers are not waived.

## Design follow-up v5.0 — work-board bilingual workflow and returned-task snapshot (2026-11-08)
- `apps/web/src/app/(app)/board/page.tsx`: kept the four existing task states and their authoritative POST actions exactly intact, while adding English/Arabic labels to each state, each move-button tooltip/accessibility label, the page heading, empty state, assignee fallback and due-date captions. Directional arrows adapt to LTR/RTL column display without changing the target state of either form.
- Added three responsive executive snapshot metrics derived **only** from the authorized `api.tasks` result: number of returned tasks, number blocked and number completed. The supporting copy explicitly notes that these are the returned tasks, not necessarily an exhaustive workspace total.
- Existing method `POST /api/govern`, hidden `intent=task`, `id`, `state`, `returnTo=/board`, task cards and `Flash` remain untouched. Source-level status-count callbacks received explicit `{ state: string }` types to prevent a `noImplicitAny` regression.
- GitHub read-back source checks **14/14 passed** for localized move controls, correct left/right progression, preserved POST contract and data rendering, honest metric scope, four original states and responsive classes. This does **not** certify a browser/keyboard/RTL visual or end-to-end validation.
- CI runs [42472753617](https://github.com/2029TEBE/TEBE/actions/runs/42472753617) and [42472793247](https://github.com/2029TEBE/TEBE/actions/runs/42472793247) were still executing for the code changes when last checked; offline checks passed, dependency audit failed. Previous head [42472453141](https://github.com/2029TEBE/TEBE/actions/runs/42472453141) passed Types and tenant isolation but failed full tests and dependency audit. Release remains blocked; review-only draft PR #442, no main merge or deployment.

## Design follow-up v5.1 — task-specific accessible action and evidence-based release blockers (2026-11-08)
- `apps/web/src/app/(app)/board/page.tsx`: for screen-reader users, a move button now announces both the actual displayed task title and the target status (EN/AR). Both previous/next task actions pass the task title into the existing `Move` presentation helper; underlying state, form POST, hidden fields, navigation and audit mechanisms remain unchanged.
- GitHub read-back **12/12 source assertions passed**: both task-specific labels, two moves, unchanged task links/states/metrics, single existing audited task POST form and the original API loader. Browser/RTL/keyboard/screen-reader acceptance is still unverified.
- Investigated the actual preceding [TEBE CI run 42472875171](https://github.com/2029TEBE/TEBE/actions/runs/42472875171): Types passed, tenant isolation passed, offline checks passed; full tests failed with 8 cases. Seven are Microsoft integration handshake/configuration/connection-state expectations; one `p0-financial-ai-privacy.test.ts` expects 403 for a manager disallowed from importing finance records but observed 400. This is a release-blocking authorization test mismatch that needs dedicated diagnosis; do not assume an innocuous test environment issue or change access behavior under design-only approval.
- Package audit showed **67 advisories (2 critical, 25 high, 31 moderate, 9 low)**, including critical advisories in `proxy-addr` (IP spoofing) and `next` (unauthenticated RCE), in the same GitHub job logs. Security triage/lockfile changes require a separately approved security hardening scope and full regression validation. **No overrides, suppressions or bypasses** were made.
- The independent TEFE review PR #19 has subsequently advanced to `36b52c0c0a24b9256b41855418d4e081da40febd` via the existing hourly design task and its current GitHub run [42473111742](https://github.com/2029TEFE/TEFE/actions/runs/42473111742) passed. Source spot-check confirmed localized homepage ARIA hooks are present. No additional TEFE edits this manual round.
- Both PRs stay draft; no merge, production, backend, database, Cloudflare, permissions or CI configuration edits in this round.

## Design follow-up v5.2 — unambiguous report destinations and integration status snapshot (2026-11-08)
- `apps/web/src/app/(app)/reports/page.tsx`: changed the generic repeated `Open` link in every report row to an explicitly named **shared board-pack** action in Arabic and English; added a clear disclosure that these links are *not* separate previews of each report definition. All links still target `/reports/board-pack`. The existing DOCX/PPTX/PDF download URLs, native report table, record fields, authorized `api.reports` loader and 3 original metrics remain unchanged. Five columns now use native `scope="col"`, the scroll region has a bilingual catalogue label, and date/schedule missing-state copy is bilingual.
- `apps/web/src/app/(app)/integrations/page.tsx`: introduced 3 existing-design read-only indicators for **other integrations returned by `api.integrations`** (returned total, connected count, error count), explicitly excluding the separately displayed Microsoft connection. Kept `MicrosoftPanel`, original admin capability check, Microsoft status query, individual integration records, and error messages unchanged. Translated connected/error state names and never-synced fallback for Arabic readers.
- GitHub source read-back **22/22 passed** (11 checks on each page), including preserved APIs, original DOCX/PPTX/PDF exports and Microsoft capability gates, three source-scoped indicators, native table, and non-mutating presentation.
- Workflow [42476431476](https://github.com/2029TEBE/TEBE/actions/runs/42476431476) for reports passed **Types and tenant isolation** but full tests were in progress at inspection; workflow [42476526775](https://github.com/2029TEBE/TEBE/actions/runs/42476526775) for integrations had passed offline checks with typecheck still pending. Audit failed on both heads due to prior high/critical dependency findings, not waived. These code checks are not authenticated browser, responsive, RTL or screen-reader acceptance.
- Only existing draft PR #442; no backend, database, tenant isolation, access rights, export implementation, financial logic, AI execution, CI, Cloudflare, main merge or production deployment changes.

## Design follow-up v5.3 — bilingual My Work workflow and native column semantics (2026-11-08)
- `apps/web/src/app/(app)/my-work/page.tsx`: localized the main page title/subtitle, overdue tasks count, signatory responsibility (accountable/consulted), outstanding criteria and ready-to-sign text, and standard task workflow status labels. Unknown task state strings keep the previous human-readable fallback. The displayed counts, timestamps and status data still come solely from `api.myWork`.
- All **three native My Work data tables** (approvals, outstanding evidence and tasks) preserve their keyboard-focusable named scroll regions, and all **11 existing header cells** now use `scope="col"` to make table navigation clearer to assistive technologies. No write action or permission/data contract changed.
- Post-commit GitHub source read-back: **15/15 assertions passed**, including tables/headers, API loader, task/approval/evidence sources, overdue dates/styles, summaries and existing absence of mutating controls. This is a source-level audit only, not a screen-reader/browser/390px RTL or full integration result.
- [Current code workflow 42477075365](https://github.com/2029TEBE/TEBE/actions/runs/42477075365) was in progress when checked, with independent source checks passed and dependency audit failed. Earlier [42476643018](https://github.com/2029TEBE/TEBE/actions/runs/42476643018) passed TypeScript, tenant isolation and offline checks but failed the 8-case integration suite and dependency security audit. These are release blockers and not suppressed.
- TEFE draft PR #19 most recently at `36b52c0c0a24b9256b41855418d4e081da40febd`, [CI 42473111742](https://github.com/2029TEFE/TEFE/actions/runs/42473111742) passed; no TEFE code change in this round. Both PRs remain drafts; no merge, deploy or backend/CI/infrastructure changes.

## Design follow-up v5.4 — accessible bilingual Updates feed (2026-11-08)
- Updated `apps/web/src/app/(app)/updates/page.tsx`: localized page title, subtitle and empty feed message, and added a named `role="feed"` region with native `article` children labelled in English/Arabic for screen-reader navigation.
- Existing source-backed `api.updates` loader, author/date/project identifiers, escalation status, `bdi` wrappers, original update creation form, project options, `pmoa_post_updates` permission and empty-list behavior remain intact. The form still renders outside the list loader. No synthetic content was added.
- Source read-back **13/13 passed** after correcting one assertion that mistakenly matched the explanatory comment `<Loaded>` instead of the real component. This is static source QA only; authenticated browser, assistive technology, Arabic RTL, 390px mobile and runtime feed behavior remain unverified.
- TEFE draft PR #19 head `36b52c0c0a24b9256b41855418d4e081da40febd`, latest CI [42473111742](https://github.com/2029TEFE/TEFE/actions/runs/42473111742) passed. TEBE latest pre-change CI [42477163242](https://github.com/2029TEBE/TEBE/actions/runs/42477163242) was still in progress, while prior CI failed on pre-existing integration tests and dependency audit. 8 integration/security failures and 67 vulnerable dependency findings are not waived or modified.
- No main branch, backend, database, authentication, security, CI workflow, dependency, infrastructure, merge or deployment changes.

## Design follow-up v5.4 — bilingual Gantt hints and accessible slippage table (2026-11-08)
- `apps/web/src/app/(app)/planner/page.tsx`: improved the timeline-only user experience by translating the Gantt baseline and progress/slippage hover labels into Arabic/English, showing a localized empty-state message and keeping the original timeline scale and source date values. The translation of the existing `{n} days late` text reuses the application's current dictionary and formatter, instead of hardcoded English-only text.
- The baseline slippage register remains a **native six-column HTML table**, now inside the existing responsive, keyboard-focusable `design-table-scroll` region with a bilingual accessible name. All six native headers now have `scope="col"` for assistive technology.
- The decorative Gantt progress fill is bounded to the visible 0–100% range and hidden from AT; all actual progress percentages continue to be shown unmodified in the source-dependent tooltip and table. Existing schedule API, date positioning, milestones, project data, creation form, and slippage logic are preserved.
- GitHub read-back of the completed source: **17/17 assertions passed**, including unchanged API read/create form, table and header counts, localized tooltips, unaltered metric text, original Gantt geometry and no new mutating calls. Separately checked mathematical fill behavior for NaN, negatives, valid, >100 and infinity.
- Source QA is **not** compiled TypeScript, authenticated 390px/mobile/RTL rendering, keyboard interaction, screen-reader output or end-to-end certification. [CI 42477373678](https://github.com/2029TEBE/TEBE/actions/runs/42477373678) for this code was in progress at inspection: offline checks passed; TypeScript and tenant isolation were pending; dependency audit still failed. No security bypass.
- The scheduled parallel task has also updated the separate `Updates` page (head `768525917d2eab55fa53a64c28be6e288b1e66be`), and its prior Types and tenant isolation checks passed at inspection. Draft PR #442 only, no backend/auth/permission/payment/RLS/CI config/Cloudflare changes, main merge or deployment.

## Design follow-up v5.5 — document evidence copy correctness and accessible bilingual register (2026-11-08)
- `apps/web/src/app/(app)/documents/page.tsx`: removed the inaccurate fixed claim that **exactly two** documents are attached to gate criteria. Explanatory copy now accurately describes how linking a file to a gate criterion supports an audit without assuming a count, in Arabic and English. The existing authorized count of `Boolean(d.evidenceFor)` and document register data are unchanged.
- Added bilingual page title and empty-state messaging, Arabic rendering for the four existing document status enums (draft/in_review/approved/superseded) with an unknown-value fallback, while preserving original enum values, status CSS logic and native create form. The document table remains native, with eight `scope="col"` headings and its existing keyboard-scrollable region carrying a distinct bilingual accessible label.
- All authorized Microsoft file-opening API links, user-provided external document links, original `DocumentUpload` control and `NewRecord` form, owner/evidence/version/date displays, and the `api.documents` loader remain unchanged.
- GitHub source read-back **20/20 assertions passed** across these invariants. This is not equivalent to a runtime integration test, visual RTL/mobile screenshot or screen-reader acceptance.
- Latest available baseline before this change: TEFE [42473111742](https://github.com/2029TEFE/TEFE/actions/runs/42473111742) passed; TEBE [42477457230](https://github.com/2029TEBE/TEBE/actions/runs/42477457230) passed Types, tenant isolation and offline source checks but failed tests and dependency audit. Audit contains high/critical dependency advisories. Security/integration blockers are not waived, and no backend, permissions, CI, deployment or merge changes were made.
