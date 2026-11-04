# THE EPMO — Contributor Instructions

Applies to human developers, contractors, reviewers, and AI coding agents. Read [the full global commercialization plan](docs/GLOBAL_PRODUCT_IMPLEMENTATION_PLAN.md) before making changes. **This document proposes a direction; it does not establish that features are built, verified, deployed, or commercially ready.**

## Mission
Develop THE EPMO as an **English-first global SaaS** selling useful free project tools, predictable-cost automated monitoring memberships, and optional genuinely AI-powered premium capabilities. Keep a separate, opt-in Arabic/Saudi enterprise experience and preserve enterprise governance.

**Value proposition:** simpler onboarding; high-quality AI-free calculators and exports; inexpensive deterministic monitoring; traceable decisions; optional AI with explicit permission, credits, and data-handling disclosures.

## Non-negotiables
1. Do not merge, deploy, buy hosting/services, enable payments, alter DNS, access live customer data, or change production without explicit authorization and evidence-based release gates. Contributions are review-only PRs.
2. Preserve all current features and safeguards: PostgreSQL RLS/tenant isolation, authorization, module entitlements, audit history, stage-gate checks, safe migrations, and existing Arabic/RTL infrastructure. Do not weaken a security control to ship a feature.
3. Global English-first does **not** mean removing Arabic translations or forcing visitors geolocated to Saudi Arabia into an Arabic page. Build `/sa` as an optional localized route. Maintain user-selectable languages and accessible alternate-language links.
4. Represent real capability accurately. A fixed rules engine is **rules-based automation**, not generative AI. Only market predictive AI when a genuine model has been trained and validated; do not promise AI-like reasoning from synthetic labels or random training data.
5. Default standard tools/agents to **zero external model calls**. Optional AI is server-controlled, opt-in, metered and fail-closed with tenant permission, cost caps, audit records, and no unintended cross-region transfer.
6. Do not assert a US hosting location because a US entity operates the business. Never make unverified security, certifications, regulatory compliance, no-training, data-residency, or privacy claims. Publish legal-operator details only after verified and approved.
7. Never reuse real customer data for training or test fixtures. Synthetic data must be non-identifying and generated in nonproduction environments. Respect confidentiality, regional transfer restrictions, retention, and deletion.
8. Preserve native editability and quality of DOCX/XLSX/PPTX exports; correctly render Arabic RTL when used. Test reopened files, formulas and layout.
9. Avoid parallel edits to the same files. Coordinate owners and PR dependencies first; use small scoped branches and keep merge conflicts visible.
10. Do not modify existing payment fail-closed defaults or enable checkout until **verified provider approval, signed webhook integrity, entitlement lifecycle, refunds/cancellations, and sandbox end-to-end evidence** are complete.

## Repository orientation
- `apps/web`: Next.js 15 / React 19 (public pages and application; currently existing root metadata specifies noindex for the private workspace).
- `apps/api`: NestJS 10 modular backend; auth, portfolio, governance, insights, licensing, exports, onboarding, notifications, billing-related platform code.
- `packages/contracts`: shared Zod contracts.
- `packages/db`: PostgreSQL schema, migrations, RLS and proof tests.
- `infra`: deployment automation; changes require separate operational approval.
- README still contains **legacy Align360 endpoints**; do not treat them as approved target URLs or automatically change running endpoints. Plan migration explicitly.

## Required contributor workflow
1. Examine current `main`, the relevant files, and open PRs. Do not assume old plans are merged.
2. Claim a workstream (WEB, TOOL, AGENT, PLATFORM/BILLING, TRUST, QA/INFRA, GROWTH) in the PR description or shared issue. Identify files you expect to edit and any dependencies.
3. Branch from the *current* agreed base; use `feat/`, `fix/`, or `docs/` names. Never push features directly to `main`.
4. Write a small PR with a summary, before/after behavior, feature flags, tenant/security impact, database migration impact, tests and exact failures, and deployment status. Use synthetic fixtures.
5. Run appropriate local checks. The repo documents `pnpm verify` and `pnpm build:packages` after contract/schema edits. Report what actually ran; do not claim success if blocked.
6. Require review for cross-tenant changes, payments, PII, AI/ML processing, exports, migrations and infrastructure. Never let a proposed UI state imply backend authorization.
7. Do not merge or deploy without explicit release decision, passed checks and reversible rollout plan.

## Product delivery sequence
**P0: foundation:** public English-first pages; private app stays non-indexed; localized /sa option; real trust/legal transparency; reusable form/schema/calculation/report components; telemetry consent and events; safe free calculators.
**P1: first conversion journey:** Project Health Check, Risk Matrix, and Executive Status Report. Basic no-login evaluation; optional account to save; professional exports; links into real tenant project records.
**P2: memberships:** shared monitoring scheduler and notification/outbox; risk, milestone and KPI exceptions; report scheduling; quotas; guarded entitlements. Existing checkout remains disabled until verified.
**P3: expanded tools:** RACI, budget variance, KPI scorecard, stage-gate readiness, portfolio prioritization, resource and data-quality checks.
**P4: optional AI:** opt-in prompt/document analysis, gated model gateway, data protection, tenant credits, no-AI fallback; only then consider a separately validated local ML model.
**P5: Saudi enterprise:** optional Arabic /sa, RTL exports, dedicated Saudi infrastructure upon real commercial/contractual demand and documented controls.

## Product rules
- Calculations must use named versioned rules and show input provenance, thresholds, timestamps, stale/missing-data warnings, and calculation limitations.
- Scheduled agents must be idempotent; limit frequency, retries, concurrent jobs, notification volume and resource use; log what ran and why. No self-authorized financial/contractual approvals.
- Free tools should be useful without upload or account creation; don't collect confidential data unnecessarily. Customer uploads must have limits, validation, malware-handling policy and retention controls.
- No silent external model processing, no unbounded tokens, no automatic paid subscription, no hidden external service dependencies.
- International pricing is only a proposal until validated. Show actual currency, billing entity, taxes, renewals, cancellation and refunds accurately when payments are enabled.

## Done means
A change is complete only when the source exists on its PR branch, relevant tests/builds have evidence, access boundaries and error cases are assessed, documentation is updated, and reviewers can reproduce. **Code merged ≠ deployed; deployed ≠ secure; a synthetic demo ≠ a validated prediction; a checkout UI ≠ payment readiness.**

See [the plan](docs/GLOBAL_PRODUCT_IMPLEMENTATION_PLAN.md) for workstream owners, delivery stages, acceptance tests, go/no-go gates, and dependency map.
