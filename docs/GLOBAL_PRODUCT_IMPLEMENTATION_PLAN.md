# THE EPMO — Global Product, Automation & Commercialization Implementation Plan
**Version:** 2026-11-04 · **Status:** Proposed technical execution plan, review only · **Repository:** `faisalwrokksa-hub/THEEPMOTEST`

## 0. Decision record — approved direction versus assumptions
**Product goal:** build a global English-first self-service software company selling AI-free standard project tools, ongoing project-monitoring services, optional genuine AI features, and premium team/enterprise governance, while retaining an optional Saudi Arabic enterprise edition.

**Operating assumptions, not verified deployment facts:** owner has a US company (legal name, tax/payment status to verify); target domain is `theepmo.com`; `/sa` is the planned Saudi Arabic destination; a low-cost Servitro VPS is under consideration/in use but its live configuration/capacity has not been verified. Current target revenue is SAR 100,000/month, **not a forecast**. No changes to production, payment status or live DNS are authorized by this document.

**Principles:** English-first, never delete RTL capability; user language choice rather than forced geo-redirect; separate legal-operator identity and data-hosting facts; minimize external AI API use; launch one valuable working conversion journey; avoid many isolated agents/services; demonstrate security, not merely claim it.

## Verified architecture and launch-state correction — 2026-11-04

The original direction remains a **proposal**, but two repositories already exist and must not be conflated:

| Existing repository | Checked `main` SHA | Ownership and verified limitations |
|---|---|---|
| [`emkanycom-hash/theepmo-website`](https://github.com/emkanycom-hash/theepmo-website) | `bbfde5248da634c10453c7af8aea5b323999144d` | Static Cloudflare marketing pages, demo, SEO and public CTAs; manual Pages deployment workflow and passing source validation, **no verified latest Pages deployment or production cutover**. |
| [`faisalwrokksa-hub/THEEPMOTEST`](https://github.com/faisalwrokksa-hub/THEEPMOTEST) | `5c37382bbf42459ca5752ed5685b731dafba947f` | Authenticated Next.js app and `/signup`, NestJS API, PostgreSQL, entitlements, payment, onboarding and release scripts. Multiple unmerged workstream PRs; do not assume the current `main` contains draft features. |

**G1 public website changes belong in the first repository.** G2 can own computation contracts in the application repo; package and expose only browser-safe, versioned calculator assets to the public site through a reviewed integration. G3/G4/G5 application/platform/security work belongs in the second repository; G5 coordinates approved legal and trust content with G1. Never assume a one-repo architecture or merge into `apps/marketing` without explicit migration authorization.

**Cloudflare intent versus proof:** user designates `alsaleemfaisal@outlook.com` for production Cloudflare ownership. `faisalsalsaleem@gmail.com` is a Gmail receiving destination, **not a verified or approved Cloudflare preview-account selection**. The marketing deployment workflow currently uses a scoped `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` variable, run manually. Separate protected GitHub Environments are a future proposal; do not assert they already exist or deploy by default.

**Known release blockers:** app [PR #388](https://github.com/faisalwrokksa-hub/THEEPMOTEST/pull/388) (public bilingual invitation-only signup) and [PR #395](https://github.com/faisalwrokksa-hub/THEEPMOTEST/pull/395) (database source organization) are unmerged; the latter passed dedicated source tests but had separate full-CI blockers. Public mail TCP ports 25/465/587/993 were refused in a 2026-11-03 external test, so email confirmation is not proven. Existing Paddle reviews remain commercial NO-GO until actual provider/settlement/entitlement evidence. **Do not contact Servitro support without explicit case-by-case user confirmation.** No demo, successful CI or drafted PR implies production rollout.

## 1. Repository findings and gaps (observed in current main)
| Area | Verified in source / repo | Gap or action |
|---|---|---|
| Web | Existing static public marketing site is in `emkanycom-hash/theepmo-website`; `apps/web` in THEEPMOTEST is a separate Next.js 15/React 19 authenticated application with bilingual root `robots: {index:false,follow:false}`. | Build indexable English marketing pages only in the marketing repo when approved; preserve private-app noindex. Validate canonical/hreflang/sitemaps and URLs rather than flipping the authenticated app's global robots settings. |
| Localization | `apps/web/src/lib/i18n.ts` supports `en/ar`; root dir applied on `html` | Keep existing language architecture and RTL. Create optional /sa localized site; no hard IP redirects; test SEO, accessible language switching, exported Arabic documents. |
| Backend | `apps/api/src/app.module.ts` imports auth, platform, portfolio, governance, insights, Excel, exports, notifications, AskX, etc. | Map implementation completeness before reuse; add reusable public-tool, calculation, background-job, monitoring and entitlement APIs rather than clone modules. |
| Data | `packages/db/src/schema.ts` defines tenant identities, memberships, sessions, portfolios, projects and governance structures; README states RLS and audit requirements | Preserve existing RLS, review migrations; add tenant-scoped saved tool runs, agent policies, findings, job/outbox ledger and quotas only if not already provided. |
| Billing | Active PRs include Paddle lifecycle and fail-closed entitlement hardening; checkout previously intentionally disabled | Treat paid self-service as **NO-GO until independent provider/webhook/settlement/entitlement/checkout proof**. Check current branch/PR state before editing; avoid conflicts with billing owners. |
| Infrastructure | README describes legacy Align360 domains and deployment instructions | Inventory actual hosts, DNS, mail, backups, staging and endpoints; do not conflate README legacy addresses with approved production. No deployment or DNS mutation by this plan. |
| Tests | README documents `pnpm verify`, package builds, tenant-isolation proof | Build actual CI evidence and regression suites for tools, monitoring, exports, security, payments and tenant boundaries. |
| Claims | Security/data location and US business identity not currently independently evidenced | Verify operator, host/backup regions, subprocessors, permissions and incident process; do not claim US-hosted, SOC2/ISO, or zero external transfer without proof. |

**Audit limitations:** This is a targeted source inspection plus known open PRs, not an exhaustive source, CI, live-host or compliance audit. Assign code owners to confirm which proposed elements already exist on other branches before duplicating them.

## 2. Final product architecture and boundaries
### Public global website
- `/` global English value proposition, proof, navigation to tools/agents/pricing/trust/learn.
- `/tools` discoverable directory; SEO page per functional tool `/tools/[slug]`; free no-sign-up demo, clear formula and sample; gated *save*, not gated basic calculation.
- `/agents` outcomes-focused monitoring service pages; no exaggeration about autonomous reasoning.
- `/pricing`, `/solutions`, `/learn`, `/trust` and legal documents, `/contact`.
- `/sa` optional Arabic/Saudi homepage and localized enterprise offering. Language chooser + hreflang, canonical, no mandatory geo redirects.
- Keep application account and private tenant workspaces **non-indexed**, authenticated and separate from public crawled routes. **Already split:** keep the existing static marketing repository and protected application deployments; any future consolidation is a separate reviewed architectural change.

### Reusable software components
1. **Tool registry:** slug, version, schema, sample inputs, public/private eligibility, category, descriptions, outputs, available plan.
2. **Schema and calculation library:** Zod validation, safe numeric precision, units/currencies/timezones, versioned transparent rules, tests, handling missing/inconsistent data.
3. **Export engine:** reusable branded HTML/PDF, spreadsheet/Word/PPT exports where justified; preserve native editability and formula/RTL quality; job limits.
4. **Saved workspace bridge:** convert a standalone result into real tenant-scoped project/risk/KPI data, with explicit mapping/preview and duplicate prevention.
5. **Agent scheduler/orchestrator:** event-trigger and periodic scans, bounded jobs, idempotency, quiet hours, deduplication, failure retries/dead letters, tenant quotas and run ledgers. Workers should not each require their own always-on process.
6. **Findings/actions:** deterministic, traceable exception events, severity thresholds, confidence/limitations, responsible person, acknowledgement, escalation, immutable evidence where appropriate.
7. **Notification service:** in-app by default, verified email integration where available, opt-in channels, suppress repeats and cap sends.
8. **Membership entitlements:** enforce access and quotas **server-side** using existing entitlement patterns; cancellation/upgrade/downgrade lifecycle, proration/refund rules, invoices, trial abuse and payment-provider verification.
9. **Optional AI gateway (later):** tenant opt-in, region policy, provider allowlist, redaction where justified, per-request caps, credit ledger, spend budgets, caching, disclosure, auditable prompts/outputs under appropriate retention, fallback to no-AI reports. No customer-data model training without proper authorization.
10. **Security/ops:** tenant RLS, session controls, access authorization, audit, backups and restore, file limits/malware mitigation, incident response, observability and customer deletion.

### Security invariants
No cross-tenant reads/writes; no client-only paid-tier restriction; no unauthorized approvals, contractual action, payments or data exports; no new unreviewed public endpoint bypassing API access; region isolation spans logs, backups, support access and external processing; safe DB migrations; all public calculators default to processing minimal non-sensitive input. Synthetic data for test only.

## 3. Prioritized catalogue and release waves
| Wave | Tool / service | User outcome | Engine | Dependency | Acceptance |
|---|---|---|---|---|---|
| Launch A | Project Health Check | Progress, budget and delivery exception score | Rules | Calculator + UI | Reproducible calculation, explicit thresholds and missing-data warning |
| Launch A | Risk Matrix / Register | Risk heat map and actions | Rules | Rule library, form | Severity matrix deterministic; valid likelihood/impact, editable download |
| Launch A | Executive Status Report | Branded management summary | Rules/templates | Export + sample input | Correct figures, readable output, native editability where offered |
| Launch B | Risk Sentinel | Ongoing risk/mitigation alerts | Rules + scheduler | Saved project, queue, permissions | No duplicate alerts, correct tenant scope, stop/resume works |
| Launch B | Schedule Watcher | Overdue milestones and dependency exceptions | Rules | Project updates | Baseline/current dates correctly handled |
| Launch B | Report Scheduler | Periodic executive report delivery | Templates + scheduler | Exports/notification | Output reproducible, retries bounded, delivery logged |
| Expansion | KPI Scorecard and KPI Watcher | Target-vs-actual reporting and alerts | Rules | KPI definitions/history | Units, freshness and denominator validated |
| Expansion | RACI Matrix | Ownership clarity | Rules/form | Roles/contracts | No duplicate/conflicting role assignments |
| Expansion | Budget Variance / Watcher | Variance and forecast issues | Formulas | Financial data | Currency rounding/period logic tested |
| Expansion | Stage Gate Readiness | Evidence-backed governance | Rules | Existing gate model | Does not bypass authorized gate decisions |
| Expansion | Portfolio Prioritization | Weighted project ranking | Rules | Configurable policy | Visible weights; sensitivity and ties handled |
| Expansion | Resource Capacity | Availability/allocation exceptions | Rules | Resource inputs | No misleading capacity figures with missing records |
| Expansion | Data Quality Watcher | Flags stale/missing/invalid data | Rules | Project records | Explain missing data separately from actual delivery risk |
| Optional | Document Risk Extraction | Structured risk candidates from unstructured docs | Genuine AI | AI gateway/permissions | Consent, evals, provenance, no silent data transfer |
| Optional | Predictive Delay Model | Calibrated risk estimates from historical outcomes | Locally hosted ML | Representative permitted data | Holdout eval, drift, explainability; synthetic-only training never called validated |
| Later | Saudi enterprise workspace | Saudi-specific UX/infrastructure/contracting | Config + deployment | Commercial demand/compliance | Regional segregation evidenced, RTL checked |

**Do not launch the full catalogue simultaneously.** Additional candidate tools: project charter, scope, WBS, milestone/Gantt, PERT, critical path, closure checklist, ROI/payback, EVM, benefits tracker, decision matrix, stakeholder map, communications plan, audit checklist, capacity planning, meeting actions, CSV converters, portfolio comparison. These extend registry/calculation/export primitives only after the first funnel proves use and retention.

## 4. Membership design (proposed; not validated prices)
| Tier | Proposed USD/month | Scope | Controls |
|---|---:|---|---|
| Free | 0 | Basic usable calculators; anonymous output previews and limited downloads | Rate limits, reasonable input size, basic bot protection |
| Starter | 19 | Saved projects, premium exports, 2 monitoring services, limited scheduled reports | 5 active projects, 20 exports/month (proposals) |
| Pro | 49 | All standard monitoring, multiple projects, recurring executive reports, optional AI credits | 20 projects, 100 exports/month; proposed 10 model credits |
| Team | 149 | Collaboration, approvals, portfolio views and richer reports | Proposed 10 seats, 100 projects, 40 AI credits |
| Business | 399+ | Governance, policy configuration, integrations, priority support | Negotiated volumes and SLA |
| Enterprise | Quote | Dedicated environments, custom policy and residency when available | Security review, contracts, validated operating model |

Pricing, quotas, AI credits, region coverage, taxes and checkout are **hypotheses**. Never publish them as working plans until feature/cost verification. Free tools should not be made unusable as a sales tactic. Standard reports remain functional with 0 AI credits.

## 5. Cross-contributor ownership map
**Lead maintainer / integration owner:** maintains decision log, target branches, PR dependency graph, code ownership, stop/go decisions, conflict resolution; only this role coordinates changes to shared contracts or app module imports.

| Stream | Primary owner | May edit | Dependencies and handoff |
|---|---|---|---|
| WEB/SEO | Frontend specialist | public route components, public metadata, SEO, localization navigation | Align with auth app routing and designer; no global robots flip |
| UX/DESIGN | Designer/front-end | brand tokens, tool templates, copy, mobile/a11y | Coordinate on shared CSS; retain existing enterprise identity |
| TOOL | Full-stack/rules specialist | tool schemas, calculation library, deterministic tests | Define contracts before integration; coordinate DB with DATA |
| AGENT | Backend specialist | scheduling, detection, run ledger, notifications | Consume TOOL rules; coordinate PLATFORM/DB; bounded costs |
| DATA/SECURITY | DB/security specialist | tenant RLS, migrations, identity, privacy, file access | Review every new tenant-scoped table and access path |
| BILLING | Commercial/backend specialist | provider lifecycle, credits, entitlements, webhooks | **No checkout enablement until independent release gate**; avoid existing active PR conflicts |
| REPORTS | Exports specialist | PDF, DOCX, XLSX, PPTX templates/test fixtures | Preserve editable outputs, bilingual RTL, numeric correctness |
| TRUST/LEGAL | Operations/legal/content | verified legal disclosures, privacy, DPA, security page | Publish only legal-approved evidence-backed statements |
| INFRA/QA | DevOps/test engineer | staging proposals, CI, performance and release evidence | No live deploy/DNS changes; backups and isolation proof before launch |
| GROWTH | Product marketing | scripts, organic SEO, demo content, analytics taxonomy | No claims of features not yet validated or live |

**Conflict policy:** one owner per shared hotspot (root layout, global CSS, `app.module.ts`, contracts, DB schema, billing module); split PRs into independent slices, use feature flags, serial integration where necessary. Do not auto-merge concurrent work.

## 6. Ordered engineering stages and go/no-go gates
### Stage 0 — baseline and ownership
- Capture main SHA, open PR list, unresolved commercial P0s, owned files and branch dependencies.
- Audit actual public site and runtime architecture; distinguish `theepmo.com` marketing, app host, hosting and legacy Align360 references.
- Inventory current auth, billing, AI SDK, export engines, notifier, analytics, i18n and tenant controls.
- Verify US operator's exact name/entity/active standing separately before public legal publication.
**Exit:** reviewed inventory + a dependency map + named owners; no source conflicts.

### Stage 1 — public-first architecture
- Extend the **existing independent marketing repository**, confirm its manual Cloudflare deployment target, source SHA and preview URL; keep the protected app's root private noindex.
- Add English homepage, tools directory and route-level metadata; accessible /sa language option and hreflang; sitemap/robots apply to public routes only.
- Design reusable tool UI, privacy notices, examples, validation, responsive mobile flow and optional save-to-workspace bridge.
**Exit:** public anonymous entry works; private routes not indexed or exposed; Arabic enterprise unaffected.

### Stage 2 — first no-AI conversion path
- Implement Project Health Check, Risk Matrix and Executive Status Report with transparent rule versions and calculations.
- Demonstrate usable anonymous input → result → downloadable professional report → optional account and save.
- Validate exports, inputs, missing data, locale, accessibility, account creation and telemetry.
**Exit:** no external model calls for standard flow, correct output and saved tenant mapping.

### Stage 3 — lightweight memberships
- Build a shared queue/scheduler and risk/schedule/report monitors using event or low-frequency triggers.
- Add server-enforced plans, metering, opt-in notifications, logs, quotas, tests and dashboard for agent status/cost.
- Integrate payment only behind *disabled* gate until provider approval, signed webhook verification, renewals/cancellation/refunds, failed payments and end-to-end receipts are proven in sandbox then staging.
**Exit:** safe trial experience; verifiable independent billing release decision before paid live checkout.

### Stage 4 — distribution and iteration
- Produce demonstration content: risk detection, project health, weekly report automation; one authentic video adapted to Shorts/X/LinkedIn.
- SEO pages must correspond to genuinely usable tools, not mass-generated thin pages.
- Track landing → tool start → successful completion → save/sign-up → paid activation → 30/90-day retention, cohort conversion and cancellations.
**Exit:** working conversion funnel and repeat value measured; revise catalogue by observed demand.

### Stage 5 — expansion and optional AI
- Expand standard rules/report library; add a gated AI gateway only when customers need unstructured reasoning, and disclose processing locations.
- ML prediction requires lawful representative outcome data, holdout performance, calibration and monitored deployment; random labels are not proof.
- Saudi enterprise regional stack only after legal/data mapping and demand; separate secrets, logs, backups, and access with Saudi-specific controls as applicable.
**Exit:** demonstrated value and customer evidence, not feature count.

**Timing:** Engineering teams should give effort estimates after Stage 0 inventory; any 30/60/90-day schedule is a proposed planning horizon, not a completion promise.

## 7. Acceptance and quality checklists
### Tool acceptance
- Accessible without unnecessary login; mobile-friendly; all inputs validated and bounded.
- Verified formulas and consistent rounding, units, time zone, missing-input behavior, policy/source version.
- No external AI requests on the standard path.
- Clear limitations; no implication that low measured risk proves real-world safety.
- Exports reopen correctly; native cells/charts/text editable where promised.

### Agent acceptance
- Explicit opt-in, run frequency and thresholds configurable; no unintended always-on inference.
- Tenant authorization and isolation tested under negative/cross-tenant cases.
- Idempotent jobs, retry/dead letter, outbox, no notification spam, pause/cancel and audit trail.
- Proven memory/CPU/storage bounds on representative load; avoid training/local LLM on low-memory production VPS.
- Human authorization needed for approvals, spending, binding commitments or irreversible changes.

### Security, billing and operations acceptance
- Auth, rate limits, RLS, entitlement guard, file validation/retention, audit and data deletion verified.
- Backups encrypted with successful restore evidence; genuine hosting and subprocessor region inventory.
- Contract/privacy/terms/contact and incident process approved; do not claim certifications without audit.
- Paddle or other provider merchant readiness, HMAC/signatures, event replay, proration and entitlement issuance tested end-to-end; keep checkout disabled otherwise.
- Record exact build/typecheck/test CI SHAs and failed cases; document evidence rather than assume a green label.
- Rollback procedure, migration safety and launch sign-off documented.

## 8. Marketing and trust execution
**Identity:** THE EPMO — Project Intelligence. Automated Work. Better Decisions. US-operated *only if the actual entity relationship is verified*; globally available product must not imply data is stored in US.

**Primary audience:** independent project managers and consultants. Secondary: small consultancy teams. Later: enterprise PMOs; optional Saudi offering.

**Content pillars:** (1) identify projects at risk, (2) automatically produce accurate management reports, (3) eliminate repetitive administration. One meaningful demo → long YouTube video + short clips + X/LinkedIn example + dedicated tool page + opt-in email lesson. Avoid claims of autonomous LLM intelligence for rules.

**Trust center:** accurate owner/legal address, actual data stores/backup/log locations, subprocessor list, external AI opt-in, deletion and retention, isolation and access controls, security contact, incident policy. Explain how standard automation can avoid third-party model requests. No badge or compliance assertion without evidence.

**North-star funnel:** visitors → tool activation → meaningful completion → account save → paid recurring monitoring activation → 30/90-day retention. Report product engagement and gross margin by cohort, not vanity social impressions.

## 9. Risk register / priority blockers
| Priority | Risk | Mitigation/owner |
|---|---|---|
| P0 | Paid checkout mistakenly enabled before entitlement/webhook/payment proof | Billing owner: fail-closed release flag; independently signed test evidence |
| P0 | Public routes inherit app-wide `noindex` or authenticated app becomes indexed | WEB/SEC: split route metadata and verify crawler behavior |
| P0 | Public tool endpoint leaks customer data or bypasses tenant isolation | DATA/SEC: anonymous/public boundary + negative tenant tests |
| P0 | Claims of AI, data privacy, US hosting or compliance are inaccurate | TRUST/LEGAL: evidence register and legal sign-off |
| P0 | Shared PRs collide with already active billing/security hardening | Lead: file ownership and dependency sequencing |
| P1 | Uncontrolled report generation or scheduled agents overload cheap VPS | AGENT/INFRA: queues, quotas and stress tests |
| P1 | Faulty formula creates misleading project assessment | TOOL/QA: golden tests, transparent rules and warning states |
| P1 | Supplier/cloud AI receives sensitive documents without consent | AI/SEC: explicit opt-in and provider/regional controls |
| P1 | Saudi language removed, damaging enterprise edition | WEB/QA: preserve i18n/RTL and localization regression |
| P2 | Large catalogue spreads team too thin | Product: ship 3 tools first; expand with usage proof |
| P2 | Weak conversion despite traffic | Growth: tool completion and retention-focused experiments |

## 10. Contributor deliverables and PR template
Every contributor should produce:
- **Baseline:** base SHA, changed files, relevant open PRs, and whether their work conflicts.
- **Implementation:** concise scope, diffs/commit SHA, migration/feature flag if any, and user-visible behavior.
- **Evidence:** commands run, result, relevant screenshots for UI, export QA, security/tenant negative tests, and performance where relevant.
- **Remaining blockers:** P0/P1/P2 with owners; no invented completions.
- **No deployment claim:** state explicitly “review-only; not merged, not deployed” until independently confirmed.

Suggested PR text:

```markdown
## Workstream / owner / dependencies
## Base commit and changed files
## User outcome / scope / out-of-scope
## Risk: tenancy, security, billing, i18n, migrations, AI processing
## Checks actually executed (commands, evidence, failures)
## Before/after screenshots or artifact QA
## Open issues / blockers / rollback
## Release status: REVIEW-ONLY — NO MERGE OR DEPLOY
```

## 11. First concurrent contributor assignments
1. **WEB:** audit the independent `theepmo-website` static pages and the protected app route separation; own public indexation and optional `/sa` there, not in `apps/web` without explicit coordination.
2. **TOOL:** implement and unit-test a pure risk matrix/health-check calculation package (no API/provider calls), with sample data.
3. **REPORTS:** define editable report templates and QA fixtures using available export libraries; avoid making test content look like real results.
4. **AGENT:** inspect notification/job infrastructure and draft bounded monitoring worker plus schema/contracts proposal; no always-on new service.
5. **BILLING/SEC:** continue existing Paddle fail-closed/P0 work; do not change payment readiness claim.
6. **TRUST/GROWTH:** collect actual company, infrastructure and security evidence; draft truthful marketing and a two-demo content plan.
7. **INTEGRATION LEAD:** resolve overlapping branches, establish interface contracts, create milestone board and acceptance checklist.

**Implementation order within the same team:** security/billing hardening in parallel with public no-AI tools; then saved workspace and monitoring; paid activation only after clearance; optional AI and Saudi dedicated deployment last.

---
**Reference:** [Repository AGENTS.md](../AGENTS.md), [README](../README.md). All public claims and commercial assumptions require real verification before publication.
