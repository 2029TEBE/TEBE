# THE EPMO — EXPERT MASTER HANDOFF & EXECUTION PROMPT
**Version:** 2026-11-04 (verified coordination revision) | **Authority:** product direction and contributor instructions; NOT production release authorization.
**Repository:** https://github.com/faisalwrokksa-hub/THEEPMOTEST
**Review-only coordination PR:** https://github.com/faisalwrokksa-hub/THEEPMOTEST/pull/422
**Five workstream issues:** #423 G1, #424 G2, #425 G3, #426 G4, #427 G5

## Verified project-state addendum — checked 2026-11-04
This addendum corrects earlier *proposals* using direct GitHub reads. It takes precedence over conflicting proposed repository/account instructions below. Source verification does **not** confirm running production infrastructure.

| Component | Source of truth and snapshot | Ownership / next action |
|---|---|---|
| Public marketing frontend | [`emkanycom-hash/theepmo-website`](https://github.com/emkanycom-hash/theepmo-website), `main` `bbfde5248da634c10453c7af8aea5b323999144d` | **Existing separate static repository**, not a planned subfolder of the application. Own `theepmo.com`, public content, anonymous tools, SEO, preview assets and outbound login links. Source-validation CI passed on this SHA; **production deployment/cutover has not been independently attested**. |
| Authenticated application, API, database | [`faisalwrokksa-hub/THEEPMOTEST`](https://github.com/faisalwrokksa-hub/THEEPMOTEST), `main` `5c37382bbf42459ca5752ed5685b731dafba947f` | Existing monorepo for `apps/web` (signup/login, tenant UI), `apps/api`, `packages/db`, shared contracts and deployment scripts. Keep internal application routes non-indexed. |
| Website deploy configuration | Standalone website workflow `.github/workflows/deploy-cloudflare-pages.yml` | Manual `workflow_dispatch`, `CLOUDFLARE_API_TOKEN` secret + `CLOUDFLARE_ACCOUNT_ID` variable; rejects missing/wrong account/project. It is **not evidence that any Cloudflare preview was successfully deployed**. |
| Registration | Application draft [PR #388](https://github.com/faisalwrokksa-hub/THEEPMOTEST/pull/388) | Bilingual invitation-only `/signup` route is **not merged or attested live**. Never treat a marketing CTA as a successful user/tenant registration; mail-request CTA stays disabled pending reliable delivery. |
| Database hygiene | Application draft [PR #395](https://github.com/faisalwrokksa-hub/THEEPMOTEST/pull/395) | Modular identity/onboarding schema source and focused checks passed; broader application security/dependency gate is unresolved. **Do not merge blindly, migrate production, or remove ledger history**. |
| Mail | External GitHub runner observation on 2026-11-03 19:59 UTC ([run](https://github.com/faisalwrokksa-hub/THEEPMOTEST/actions/runs/41708306345)) | `mail.theepmo.com` TCP ports 25, 465, 587 and 993 were **refused at observation time**. No newer successful inbox delivery proof. **Never contact Servitro support by email, ticket, portal message or reply without the user's explicit case-by-case confirmation**. |
| Billing | Unmerged Paddle cutover/hardening PRs including [#392](https://github.com/faisalwrokksa-hub/THEEPMOTEST/pull/392), [#421](https://github.com/faisalwrokksa-hub/THEEPMOTEST/pull/421) | Source/CI claims must be bound to exact PR head and release candidate. Live checkout is **NO-GO**. Historical Stripe financial records must be retained for integrity/audit; do not reactivate legacy Stripe runtime. |

**Account routing:** `alsaleemfaisal@outlook.com` is the *user-designated* production Cloudflare owner, not a connector-verified login. `faisalsalsaleem@gmail.com` is the user's Gmail destination for receiving mail and **must not be presumed an authorized Cloudflare staging account**. Select any nonproduction Cloudflare account/project only after the owner explicitly approves it and deployment credentials are verified; use separate least-privilege credentials. Both GitHub repositories are currently public: no customer data, private backend implementation artifacts, keys, credentials or sensitive environment files in marketing assets or issues.

**Repository and route ownership:** G1 public homepage, SEO, `/tools`, `/pricing`, `/sa` and approved legal/trust pages → standalone marketing repository. G2 computation engines, typed contracts and authenticated save bridge → application monorepo, with a reviewed browser-safe distribution contract for G1. G3–G5 monitoring, paid entitlements, API, security, database and infra → application monorepo; G5 coordinates shared legal/trust disclosures across both repos. Authentication, invitation acceptance, tenant data and `/signup` → application, not static marketing. This is **two repositories and five workstreams**, not five repos or one consolidated repo.

**Operational gate:** A passing repo build ≠ a Cloudflare Pages publication ≠ verified production DNS/SSL/private-app integration. Record deployment account, exact source SHA, verified URL, headers, routing, rollback and owner approval independently. Do not automate a transfer or merge between repositories.

## 1. Mandate and decision rights
You are an expert engineer/architect collaborating with other human/AI experts. Inspect *current* main, open PRs, actual CI, deployment and security evidence before editing. Implement the global-first THE EPMO strategy in review-only branches with verifiable deliverables. Preserve existing customer/enterprise code and data. No unapproved merge, production deploy, DNS/mail mutation, paid service purchase, live payment enablement, or destructive DB command. Do not treat this prompt as permission to bypass review and release gates. Never ask for or publish passwords, API tokens, private keys or live customer records in chat, issues or logs.

### Business objective
THE EPMO — “Project Intelligence. Automated Work. Better Decisions.”
An English-first global SaaS selling (a) genuinely useful registration-free project tools; (b) professional standalone outputs; (c) recurring rules-based monitoring and scheduled reports; (d) optional genuine AI/ML under explicit opt-in and credit limits; (e) team/business/enterprise project, portfolio and governance products. Target SAR 100,000 monthly recurring revenue is aspirational, not validated demand or achieved revenue. Start with independent project managers/consultants and small teams; Saudi enterprise is a specialized later offering.

**Truthful capability distinction:** if/else rules + schedules = automated/rules-based agents, NOT inherently generative AI. Only advertise predictive AI for validated trained models. Synthetic scenarios are for tests, not evidence of predictive accuracy. Ordinary monitoring must work without third-party model APIs.

## 2. Intended account allocation — independently verify access before deployment
| Service | Identity / owner | Intended function | Verification status |
|---|---|---|---|
| Cloudflare primary | alsaleemfaisal@outlook.com | Authoritative DNS for theepmo.com, final public marketing/tools, caching/TLS/security | User-supplied account allocation; access/records not independently audited |
| Cloudflare development | **Not designated** | Isolated previews, with the owner's express account/project approval | Do **not** infer authorization from the Gmail forwarding address or the old pending Cloudflare zone |
| GitHub | faisalwrokksa-hub + emkanycom-hash | Separate application monorepo and marketing website, contributor branches, CI, review-only PRs | Both repositories verified accessible via GitHub connector; see addendum |
| Hosting | Existing Servitro VPS | Protected NestJS API, Next.js authenticated application, PostgreSQL, bounded workers, export jobs and potentially mail | Current provisioning/security/capacity not independently verified |
| Business identity | User-owned US company | Intended legal merchant/operator | Exact legal name/state/entity/payment eligibility must be verified privately |
| Payments | Existing Paddle-oriented code and active PRs | Candidate global subscription provider | **Not verified for live checkout; keep disabled** |
| Transactional mail | Existing Servitro/mail or alternative provider | Auth, verification, receipts and monitored alerts | Real delivery/domain authentication unverified |

Do not assume incorporation in the US means US data hosting. Disclose *actual* storage, processing, logs, backup, subprocessors and AI transfer regions. Do not share account sign-in credentials between contributors. Implement least privilege and rotate/exclude compromised secrets.

## 3. Repository architecture — existing two repositories, five coordinated workstreams
Keep the **existing standalone marketing repository** `emkanycom-hash/theepmo-website` and the **application monorepo** with `apps/web` (Next.js private EPMO), `apps/api` (NestJS), `packages/contracts` (shared Zod), `packages/db` (Postgres schema, RLS), and `infra`. Do not consolidate them by default. Proposed additions inside the application monorepo only after dependency and ownership review:
- `apps/marketing/` — **deferred alternative only if a separately approved consolidation/migration replaces the already existing marketing repository; not the present G1 target**.
- `packages/calculations/` — pure versioned deterministic domain formulas shared by browser and server.
- `packages/tools/` — tool registry, schemas, sample inputs, output contracts.
- `packages/agent-rules/` — monitoring predicates, severity and findings.
- `packages/reports/` — templates and export generation.
- `packages/ui/` — only if duplication justifies it.
- `apps/worker/` — **optional**, only if existing NestJS queue/job infrastructure is insufficient.
- `.github/workflows/` — scoped CI preview/release; `.github/CODEOWNERS` — ownership after maintainers agree.

Five *workstreams* are not five repositories and do not require five permanent long-lived branches. Small, short-lived topic branches, review-only PRs and mutually agreed ownership for `root layout`, global CSS, app modules, schemas/contracts, auth/billing and infra. Do not mass-move current directories. Preserve existing Arabic/RTL translations and native Office export editability.

## 4. Cloudflare and backend deployment model
**Recommended:** The **existing separate static marketing repository** supplies `theepmo.com` public site and planned `/tools`, `/agents`, `/pricing`, `/trust`, `/sa`; use browser-only calculations for anonymous data where feasible. The production Cloudflare account is user-designated but unaudited. Provision an isolated preview project in an **owner-approved account**, not automatically in the Gmail account; validate exact URL, GitHub source and CI logs. Keep production DNS untouched until a reviewed release.

**Protected backend:** `app.theepmo.com` (authenticated Next.js), `api.theepmo.com` (NestJS), PostgreSQL/RLS, scheduled monitoring, subscriptions, exports, notifications and optional model gateway, initially targeted to protected Servitro hosting subject to capacity, security and recovery verification.

**Important technical constraint:** current `apps/web` uses Next.js 15 App Router, server-side cookies/auth and `output:'standalone'`. It is **not a proven static Cloudflare Pages export**. Do NOT set an invented build/output directory for the existing app. **Use the existing separate static marketing repository (preferred)**; migrating it into `apps/marketing` requires a separate approved proposal. A Cloudflare-compatible Next.js adapter for the authenticated app is an alternative only after SSR/auth/cookie/build/security verification.

**No anonymous private-data leak:** browser processing is default for public calculators; if an export must hit a backend, obtain informed consent, limit uploads and payloads, retain/delete correctly, rate-limit and isolate processing. A public website is not a reason to bypass account or tenant authorization.

**Development preview acceptance:** account/project identified, repo/branch source proven, exact CI/Wrangler build steps documented, successful build logs, working preview URL, synthetic demos, no credentials/customer data, public/private route separation and rollback process. Do not claim the preview exists until actually verified.

### Required GitHub CI environment variables/secrets
**Current reality:** the independent marketing repository has a manually triggered Pages workflow that reads a GitHub Actions secret `CLOUDFLARE_API_TOKEN` and repository variable `CLOUDFLARE_ACCOUNT_ID`; it checks the target Pages project before deploying. **Proposed improvement:** move to protected GitHub Environments `cloudflare-development` and `cloudflare-production` with separately scoped credentials, named projects and required production reviewers. Do not assume these environments already exist. Add compatibility variables only after verified build strategy. These are **names**, not values. No global unrestricted Cloudflare key; no keys in repo, screenshots, issue comments or frontend bundle. GitHub account access for experts must be individually granted at least privilege. Production changes require explicit review.

### APIs / vendors — what is actually needed
**Core:** GitHub repository integration + Actions; scoped Cloudflare deployment API/Wrangler; secure backend/database configuration; authentication/session secrets; transactional email if sign-up/notifications are enabled; payment provider webhooks/credentials only when merchant approved and live checkout authorized. Cloudflare Turnstile/analytics are useful free-tier options, subject to validation.

**Optional, NOT required to ship free tools:** OpenAI/Anthropic/Gemini AI API; ML provider; GPU; Cloudflare KV/D1/R2; external analytics platform; extra paid VPS; new Saudi hosting; extra GitHub/Cloudflare accounts. If AI API added, use server-side per-tenant opt-in, caps, allowlist, cost budget, audit and no-AI fallback. Do not sell customer data or train on it without an applicable legal basis/explicit authorization.

## 5. Five non-overlapping delivery workstreams (GitHub issues)
### G1 — Website / acquisition / localization — #423
Owner: frontend lead. **Primary repository: `emkanycom-hash/theepmo-website`**, not the private Next.js application. Build English public product website, free-tools discovery, detailed tool landing pages, pricing, agent directory, /trust, /learn, /sa. SEO should index only approved public routes; current private web root uses `robots:noindex`. Implement explicit route separation and hreflang/canonical/sitemaps without forcing Saudis into Arabic or deleting RTL. Deliver test screenshots, accessible responsive UX and preview build evidence. Integrate tool contracts from G2. Shared root layout/global CSS edits require coordination.

### G2 — Deterministic tools / forms / reports — #424
Owner: formulas and exports lead. First usable anonymous tools: Project Health Check, Risk Matrix/Register and Executive Status Report. Add reusable forms, Zod schemas, typed outputs, versioned threshold policy, edge/missing data handling, transparent explanations, synthetic examples and basic downloads. Next: KPI, RACI, budget variance, stage gate. Exports where offered must reopen and remain genuinely editable (XLSX/DOCX/PPTX) with correct values/branding/RTL; PDF only where appropriate. Browser-side standard paths = zero AI API requests. Coordinate save-to-tenant contract with G3.

### G3 — Lightweight monitoring / subscriptions' recurring value — #425
Owner: backend rules and jobs lead. Shared worker/scheduler and audit run ledger; first Risk Sentinel, Schedule Watcher, Executive Report Scheduler. Later KPI, budget, governance and data-quality watchers. Idempotency, deduplication, bounded retries, pause/cancel, quiet hours, notification opt-in, no spam, tenant isolation and resource quotas. Material approvals/spend/contract changes require authorized human action. Do not spin up 12 always-on services; no mandatory LLM.

### G4 — Entitlements, provider billing, optional AI — #426
Owner: existing payment/billing specialist. Audit ACTIVE Paddle PRs for overlapping files before edits. Backend-only plan limits, accurate subscription state, credits, safe cancellation/renewal/refund, sandbox signed webhooks, failed-payment handling, invoice/tax requirements, checkout-to-entitlement proof. **Live payments are NO-GO until separately cleared.** Later opt-in AI gateway with provider/region policy, per-request credits and fallback. Proposed $0/$19/$49/$149/$399+ plans are hypotheses, not approved product claims.

### G5 — Security, hosting, trust, QA and growth — #427
Owner: ops/security lead + marketer. Verify actual US legal entity, DNS/hosting region, backup/restore, incident response, tenant auth/RLS, session permissions, mail delivery, subprocessor/data residency inventory. Draft evidence-based Trust Center, real privacy and contract terms; do not claim US-hosted, SOC2 or ISO certification without proof. Plan Saudi Arabic enterprise and dedicated region **only when actual demand and legal review justify it**. Coordinate meaningful YouTube/X/LinkedIn/SEO tool demos; track landing → tool start → useful completion → account save → paid activation → 30/90-day retention rather than vanity metrics. No production infra changes by this workstream without separate authorization.

## 6. Engineering and commercial acceptance
**P0 baseline:** inspect **both repo HEADs**, PRs, owners and infra, with `main` snapshots in the addendum above; recheck before each change. The application README contains legacy Align360 host references; do not treat them as live-approved deployment targets. Capture base SHAs, open PR dependencies and repo tests.

**Release sequence:** (1) nonprod Cloudflare preview and page separation; (2) 3 high-quality AI-free tools; (3) optional account/save-to-workspace; (4) 1–3 bounded monitoring agents; (5) fully verified billing; (6) marketing/trust publication and customer feedback; (7) wider catalogue, optional AI, Saudi enterprise.

**Each feature:** tests for valid/invalid/missing data; role and cross-tenant negative tests; true no-AI standard path; bounded job/exports and abuse controls; exact CI/build/test evidence; real screenshots where relevant; no fabricated production proof. Repo documents `pnpm verify`, and `pnpm build:packages` after shared schema/contracts changes. No staging or production database reseed or destructive setup. Respect DB migrations and RLS checks.

**Specific launch blockers:** unmerged authenticated `/signup` hotfix #388, unverified invitation mail and SMTP/IMAP listeners, database source PR #395 with broader CI/security blockers, verified DNS/Cloudflare target and live deployment attestation, independent payment-provider verification (Paddle), signed callback and entitlement lifecycle, secure deployment/backup/restore, verified mail/delivery, accessible indexation boundaries, legal privacy/hosting/AI disclosure, negative tenant authorization and actual resource capacity. Do not remove a blocker merely to claim a launch.

## 7. Mandatory expert handoff — tell the integration lead before coding
Provide in your initial response or PR/issue:
1. **Identity and workstream:** your GitHub username, expertise, and G1–G5 ownership; confirm repository permissions.
2. **Repo snapshot:** current `main` SHA, relevant open/merged PRs, branch base, files you will own and conflicts.
3. **Environment inventory (no secrets):** which Cloudflare account/project you can access, project names, whether GitHub integration/Wrangler CI works; verified preview URLs; Servitro/staging availability; what is *not* accessible.
4. **Technical choices:** actual marketing build framework and output, common package contracts, SSR/static decision, minimum backend resources, RLS/authorization impact, proposed migrations.
5. **Dependencies:** APIs or service *names* needed; exact permissions/scopes and who is responsible for provisioning; never paste credential values.
6. **Security claims and data map:** actual customer data path, regions, logging/backups, subprocessors, external AI use or prohibition, file handling.
7. **Implementation slices:** PR breakdown, acceptance tests, risks and rollback. No speculative deadlines until code/infrastructure inspection.
8. **Evidence:** tested commands, results, build logs, preview URL, screenshots, export QA and commit/PR links.
9. **Blockers:** P0/P1/P2, responsible owner, required decision, contingency.
10. **Release status:** explicitly state *planned*, *coded*, *CI-verified*, *staged* or *live*. Never equate PR creation with deployment.

If you lack access to Cloudflare or live hosting, implement isolated source and CI configuration first and document the exact account-owner action needed. Do not attempt login workarounds, request passwords over chat or fabricate deployment claims.

## 8. Coordination / finish definition
- Use root `AGENTS.md`, `docs/GLOBAL_PRODUCT_IMPLEMENTATION_PLAN.md` (PR #422), the **existing marketing repository README**, and the verified addendum above together. Conflicting older one-repo or Gmail-Cloudflare preview instructions are superseded.
- Each workstream owns independent files; coordinate shared hotspots. One maintainer reconciles PRs and verifies dependencies.
- Every milestone produces a branch, exact commit SHA, review-only PR, evidence, remaining blockers and a release decision record.
- No automatic merge/deploy, billing activation, DNS/SSL/mail change, customer-data migration or paid vendor signup.
- A feature is complete only when code is present and relevant checks actually pass; commercial readiness additionally needs independent security, payment, hosting and legal evidence.

**Immediate assignment:** G1 confirms safe Cloudflare preview strategy; G2 begins pure deterministic Risk Matrix/Project Health modules; G3 inventories existing scheduler/notifications; G4 continues Paddle fail-closed readiness; G5 inventories infrastructure and trust disclosures. Build real code, not only plans, but keep live operations protected.

## 9. Verified review refresh — 2026-11-04 (PR #422)

This section supersedes older snapshots only where explicitly stated. It is a **GitHub-source-only review**, not an audit of production hosting, Cloudflare, mail delivery, payments, or customer data.

### Confirmed source baseline
- Application `main`: `5c37382bbf42459ca5752ed5685b731dafba947f` (GitHub branch read). Marketing `main`: `bbfde5248da634c10453c7af8aea5b323999144d` (GitHub branch read). Both remain separate repositories; G1 changes must be made in the marketing repository, not copied wholesale into the application.
- This handoff originated in commit `7acd55ea475a16694269e9679ce32d2f39f0811e`, but **that SHA is a historical source reference, not the current PR head or a production release**. PR #422 is open/draft/review-only; inspect its current head after each amendment.
- Application invitation-only signup PR #388 remains open/draft at `e7272010360c925fb43b5554823dd57592f5e204`. Database-source organization PR #395 remains open/draft at `a2119f09ff32d398b8f1857459c5353ce893a652`. Their existence does not repair a live `/signup` 404 or prove safe database access.
- At the time of review, PR #422's previous head `43fd8c694ddcb99d786c2ccaa11a5e640c9c70dd` had GitHub Actions CI run `41789179474` **completed with failure**. Its result is not a green validation; inspect failed jobs and rerun checks on the *new* commit before requesting merge.
- Other open review-only changes cover Paddle lifecycle watermarks, fail-closed entitlements, retired Stripe UI assertions and offline mail-evidence parsing. These PRs are not release proof and must be integrated by the responsible owners without overlapping uncontrolled merges.

### Mandatory P0 handoff decisions and proof requirements
| Area | Current decision | Required proof before calling it complete |
| --- | --- | --- |
| Marketing / Cloudflare | Keep website in `emkanycom-hash/theepmo-website`, manually deployed only with approved account/project | Exact public/development account, source SHA, verified Pages deployment URL, HTTP/TLS and rollback evidence |
| App registration | Do not describe public /signup as deployed; #388 is draft | Live route check, end-to-end registration/invitation, safe abuse controls, user/tenant authorization and mailbox delivery |
| Database | Preserve migrations, RLS and non-public password material; #395 remains draft | Negative cross-tenant tests, role/grant audits and reviewed migration plan; no live destructive changes |
| Paddle / Stripe retirement | Continue review-only, fail-closed Paddle cutover; eliminate executable Stripe checkout/settings where safely reviewed | Approved merchant configuration, sandbox signed webhooks, lifecycle and entitlement proofs; preserve historical ledger records for audit, never reactivate legacy Stripe billing |
| Email | Treat externally refused SMTP/IMAP ports and unverified receipt as unresolved | Independent inbound/outbound mailbox and DNS authentication evidence; no Servitro support contact without explicit case-by-case owner approval |
| Security and release | No production authorization from a docs PR | Successful scoped CI on exact release SHA, secrets/PII review, backup/restore, SSL, RLS, audit, accessibility and owner release sign-off |

### Next integration order (without bypassing review)
1. Triage PR #422's failed CI and publish failing job/step details; do not label documentation-only CI as full application verification.
2. Assign owners for the existing signup, database, Paddle and mail PR families; consolidate overlapping work in controlled integration candidates after checking diff/CI, avoiding duplicate changes.
3. Implement G1 website work in the existing marketing repository and G2 calculations/contracts in the application repository with a reviewed browser-safe integration boundary.
4. Preserve a hard **NO-GO** for live checkout, outbound support contact, production DNS/SSL/mail mutations, merge/deploy and destructive database changes unless individually authorized with evidence.
5. In every new handoff, report the latest exact HEADs, CI run IDs/conclusions, review PR URLs, verified environment status and remaining blockers; never represent stale SHA snapshots as live status.
