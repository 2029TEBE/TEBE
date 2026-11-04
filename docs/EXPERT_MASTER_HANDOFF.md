# THE EPMO — EXPERT MASTER HANDOFF & EXECUTION PROMPT
**Version:** 2026-11-04 | **Authority:** product direction and contributor instructions; NOT production release authorization.
**Repository:** https://github.com/faisalwrokksa-hub/THEEPMOTEST
**Review-only coordination PR:** https://github.com/faisalwrokksa-hub/THEEPMOTEST/pull/422
**Five workstream issues:** #423 G1, #424 G2, #425 G3, #426 G4, #427 G5

## 1. Mandate and decision rights
You are an expert engineer/architect collaborating with other human/AI experts. Inspect *current* main, open PRs, actual CI, deployment and security evidence before editing. Implement the global-first THE EPMO strategy in review-only branches with verifiable deliverables. Preserve existing customer/enterprise code and data. No unapproved merge, production deploy, DNS/mail mutation, paid service purchase, live payment enablement, or destructive DB command. Do not treat this prompt as permission to bypass review and release gates. Never ask for or publish passwords, API tokens, private keys or live customer records in chat, issues or logs.

### Business objective
THE EPMO — “Project Intelligence. Automated Work. Better Decisions.”
An English-first global SaaS selling (a) genuinely useful registration-free project tools; (b) professional standalone outputs; (c) recurring rules-based monitoring and scheduled reports; (d) optional genuine AI/ML under explicit opt-in and credit limits; (e) team/business/enterprise project, portfolio and governance products. Target SAR 100,000 monthly recurring revenue is aspirational, not validated demand or achieved revenue. Start with independent project managers/consultants and small teams; Saudi enterprise is a specialized later offering.

**Truthful capability distinction:** if/else rules + schedules = automated/rules-based agents, NOT inherently generative AI. Only advertise predictive AI for validated trained models. Synthetic scenarios are for tests, not evidence of predictive accuracy. Ordinary monitoring must work without third-party model APIs.

## 2. Confirmed account allocation — do not interchange credentials
| Service | Identity / owner | Intended function | Verification status |
|---|---|---|---|
| Cloudflare primary | alsaleemfaisal@outlook.com | Authoritative DNS for theepmo.com, final public marketing/tools, caching/TLS/security | User-supplied account allocation; access/records not independently audited |
| Cloudflare development | faisalsalsaleem@gmail.com | Isolated nonproduction preview/staging, synthetic data and test builds | User-supplied account allocation; access/projects not independently audited |
| GitHub | faisalwrokksa-hub | Single THEEPMOTEST monorepo, contributor branches, issues, CI, review-only PRs | Repo and GitHub PR/issues accessible via connector |
| Hosting | Existing Servitro VPS | Protected NestJS API, Next.js authenticated application, PostgreSQL, bounded workers, export jobs and potentially mail | Current provisioning/security/capacity not independently verified |
| Business identity | User-owned US company | Intended legal merchant/operator | Exact legal name/state/entity/payment eligibility must be verified privately |
| Payments | Existing Paddle-oriented code and active PRs | Candidate global subscription provider | **Not verified for live checkout; keep disabled** |
| Transactional mail | Existing Servitro/mail or alternative provider | Auth, verification, receipts and monitored alerts | Real delivery/domain authentication unverified |

Do not assume incorporation in the US means US data hosting. Disclose *actual* storage, processing, logs, backup, subprocessors and AI transfer regions. Do not share account sign-in credentials between contributors. Implement least privilege and rotate/exclude compromised secrets.

## 3. Repository architecture — one monorepo, not five repositories
Keep existing `apps/web` (Next.js private EPMO), `apps/api` (NestJS), `packages/contracts` (shared Zod), `packages/db` (Postgres schema, RLS), and `infra`. Proposed additions only after dependency audit:
- `apps/marketing/` — separately buildable static-first English public marketing and browser tools for Cloudflare.
- `packages/calculations/` — pure versioned deterministic domain formulas shared by browser and server.
- `packages/tools/` — tool registry, schemas, sample inputs, output contracts.
- `packages/agent-rules/` — monitoring predicates, severity and findings.
- `packages/reports/` — templates and export generation.
- `packages/ui/` — only if duplication justifies it.
- `apps/worker/` — **optional**, only if existing NestJS queue/job infrastructure is insufficient.
- `.github/workflows/` — scoped CI preview/release; `.github/CODEOWNERS` — ownership after maintainers agree.

Five *workstreams* are not five repositories and do not require five permanent long-lived branches. Small, short-lived topic branches, review-only PRs and mutually agreed ownership for `root layout`, global CSS, app modules, schemas/contracts, auth/billing and infra. Do not mass-move current directories. Preserve existing Arabic/RTL translations and native Office export editability.

## 4. Cloudflare and backend deployment model
**Recommended:** Cloudflare primary account serves `theepmo.com` public site and `/tools`, `/agents`, `/pricing`, `/trust`, `/sa`; use browser-only calculations for anonymous data where feasible. Cloudflare development account hosts a preview under its own unconnected preview URL, provisioned from protected GitHub CI/Wrangler configuration if account/project linking restrictions require it. Keep production DNS untouched until a reviewed release.

**Protected backend:** `app.theepmo.com` (authenticated Next.js), `api.theepmo.com` (NestJS), PostgreSQL/RLS, scheduled monitoring, subscriptions, exports, notifications and optional model gateway, initially targeted to protected Servitro hosting subject to capacity, security and recovery verification.

**Important technical constraint:** current `apps/web` uses Next.js 15 App Router, server-side cookies/auth and `output:'standalone'`. It is **not a proven static Cloudflare Pages export**. Do NOT set an invented build/output directory for the existing app. Either deploy a separate static `apps/marketing` (preferred) or validate an actual Cloudflare-compatible Next.js runtime adapter, SSR/auth/cookie behavior, build and routing before preview.

**No anonymous private-data leak:** browser processing is default for public calculators; if an export must hit a backend, obtain informed consent, limit uploads and payloads, retain/delete correctly, rate-limit and isolate processing. A public website is not a reason to bypass account or tenant authorization.

**Development preview acceptance:** account/project identified, repo/branch source proven, exact CI/Wrangler build steps documented, successful build logs, working preview URL, synthetic demos, no credentials/customer data, public/private route separation and rollback process. Do not claim the preview exists until actually verified.

### Required GitHub CI environment variables/secrets
Create two *GitHub Environments* — `cloudflare-development` and `cloudflare-production` — with separately scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Environment-scoped production token requires protected reviewers. Add project name/compatibility variables only after confirmed build strategy. These are **names**, not values. No global unrestricted Cloudflare key; no keys in repo, screenshots, issue comments or frontend bundle. GitHub account access for experts must be individually granted at least privilege. Production changes require explicit review.

### APIs / vendors — what is actually needed
**Core:** GitHub repository integration + Actions; scoped Cloudflare deployment API/Wrangler; secure backend/database configuration; authentication/session secrets; transactional email if sign-up/notifications are enabled; payment provider webhooks/credentials only when merchant approved and live checkout authorized. Cloudflare Turnstile/analytics are useful free-tier options, subject to validation.

**Optional, NOT required to ship free tools:** OpenAI/Anthropic/Gemini AI API; ML provider; GPU; Cloudflare KV/D1/R2; external analytics platform; extra paid VPS; new Saudi hosting; extra GitHub/Cloudflare accounts. If AI API added, use server-side per-tenant opt-in, caps, allowlist, cost budget, audit and no-AI fallback. Do not sell customer data or train on it without an applicable legal basis/explicit authorization.

## 5. Five non-overlapping delivery workstreams (GitHub issues)
### G1 — Website / acquisition / localization — #423
Owner: frontend lead. Build English public product website, free-tools discovery, detailed tool landing pages, pricing, agent directory, /trust, /learn, /sa. SEO should index only approved public routes; current private web root uses `robots:noindex`. Implement explicit route separation and hreflang/canonical/sitemaps without forcing Saudis into Arabic or deleting RTL. Deliver test screenshots, accessible responsive UX and preview build evidence. Integrate tool contracts from G2. Shared root layout/global CSS edits require coordination.

### G2 — Deterministic tools / forms / reports — #424
Owner: formulas and exports lead. First usable anonymous tools: Project Health Check, Risk Matrix/Register and Executive Status Report. Add reusable forms, Zod schemas, typed outputs, versioned threshold policy, edge/missing data handling, transparent explanations, synthetic examples and basic downloads. Next: KPI, RACI, budget variance, stage gate. Exports where offered must reopen and remain genuinely editable (XLSX/DOCX/PPTX) with correct values/branding/RTL; PDF only where appropriate. Browser-side standard paths = zero AI API requests. Coordinate save-to-tenant contract with G3.

### G3 — Lightweight monitoring / subscriptions' recurring value — #425
Owner: backend rules and jobs lead. Shared worker/scheduler and audit run ledger; first Risk Sentinel, Schedule Watcher, Executive Report Scheduler. Later KPI, budget, governance and data-quality watchers. Idempotency, deduplication, bounded retries, pause/cancel, quiet hours, notification opt-in, no spam, tenant isolation and resource quotas. Material approvals/spend/contract changes require authorized human action. Do not spin up 12 always-on services; no mandatory LLM.

### G4 — Entitlements, provider billing, optional AI — #426
Owner: existing payment/billing specialist. Audit ACTIVE Paddle PRs for overlapping files before edits. Backend-only plan limits, accurate subscription state, credits, safe cancellation/renewal/refund, sandbox signed webhooks, failed-payment handling, invoice/tax requirements, checkout-to-entitlement proof. **Live payments are NO-GO until separately cleared.** Later opt-in AI gateway with provider/region policy, per-request credits and fallback. Proposed $0/$19/$49/$149/$399+ plans are hypotheses, not approved product claims.

### G5 — Security, hosting, trust, QA and growth — #427
Owner: ops/security lead + marketer. Verify actual US legal entity, DNS/hosting region, backup/restore, incident response, tenant auth/RLS, session permissions, mail delivery, subprocessor/data residency inventory. Draft evidence-based Trust Center, real privacy and contract terms; do not claim US-hosted, SOC2 or ISO certification without proof. Plan Saudi Arabic enterprise and dedicated region **only when actual demand and legal review justify it**. Coordinate meaningful YouTube/X/LinkedIn/SEO tool demos; track landing → tool start → useful completion → account save → paid activation → 30/90-day retention rather than vanity metrics. No production infra changes by this workstream without separate authorization.

## 6. Engineering and commercial acceptance
**P0 baseline:** inspect repo HEAD, PRs, owners and infra. Current README contains legacy Align360 host references; do not treat them as live-approved deployment targets. Capture base SHAs, open PR dependencies and repo tests.

**Release sequence:** (1) nonprod Cloudflare preview and page separation; (2) 3 high-quality AI-free tools; (3) optional account/save-to-workspace; (4) 1–3 bounded monitoring agents; (5) fully verified billing; (6) marketing/trust publication and customer feedback; (7) wider catalogue, optional AI, Saudi enterprise.

**Each feature:** tests for valid/invalid/missing data; role and cross-tenant negative tests; true no-AI standard path; bounded job/exports and abuse controls; exact CI/build/test evidence; real screenshots where relevant; no fabricated production proof. Repo documents `pnpm verify`, and `pnpm build:packages` after shared schema/contracts changes. No staging or production database reseed or destructive setup. Respect DB migrations and RLS checks.

**Specific launch blockers:** independent payment-provider verification (Paddle), signed callback and entitlement lifecycle, secure deployment/backup/restore, verified mail/delivery, accessible indexation boundaries, legal privacy/hosting/AI disclosure, negative tenant authorization and actual resource capacity. Do not remove a blocker merely to claim a launch.

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
- Use root `AGENTS.md` and `docs/GLOBAL_PRODUCT_IMPLEMENTATION_PLAN.md` (PR #422) together with this handoff.
- Each workstream owns independent files; coordinate shared hotspots. One maintainer reconciles PRs and verifies dependencies.
- Every milestone produces a branch, exact commit SHA, review-only PR, evidence, remaining blockers and a release decision record.
- No automatic merge/deploy, billing activation, DNS/SSL/mail change, customer-data migration or paid vendor signup.
- A feature is complete only when code is present and relevant checks actually pass; commercial readiness additionally needs independent security, payment, hosting and legal evidence.

**Immediate assignment:** G1 confirms safe Cloudflare preview strategy; G2 begins pure deterministic Risk Matrix/Project Health modules; G3 inventories existing scheduler/notifications; G4 continues Paddle fail-closed readiness; G5 inventories infrastructure and trust disclosures. Build real code, not only plans, but keep live operations protected.
