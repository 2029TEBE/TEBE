# THEEPMO — TEBE six-locale frontend release gate
Reviewed: 2026-11-08. Draft frontend PR #442 only; release NOT approved.

## Scope and confirmed source changes
- One authenticated dashboard route and one global native locale selector with en/ar-SA/de-DE/zh-CN/fr-FR/ja-JP.
- Same selector available on login. Legacy pmo_lang=en|ar preserved, separate pmo_locale frontend cookie; first-visit browser language hint and saved selection precedence.
- One frontend-only English-source catalog apps/web/src/lib/ui-labels.mjs with 54 entries for DE/ZH/FR/JA; includes all shared navigation labels and selected executive-decision copy.
- Shared web tr() adapter and inline executive story migration preserve existing Arabic @pmo/contracts dictionary and backend EN/AR document-generation contract.
- RTL only for ar-SA, root document and authenticated shell use the selected locale. API status values, tenant, auth, data, billing, finance and exports unchanged.
- Source tests cover six-locale normalization, catalog fallback, full navigation labels, executive labels, cookie compatibility and semantic layout.

## Incomplete and unverified
- 54 entries do not cover full application strings or all interactions. Many English/Arabic inline conditions, login text, widgets, project screens and notifications remain to be migrated.
- Missing translations intentionally render English. No automatic translation API, editorial approval/sync or all-screen completeness gate yet.
- Account-backed locale preference and TEFE↔TEBE preference transfer not implemented. Country/IP hint resolver exists but is not connected to a verified frontend/edge country source.
- No six-locale authenticated browser certification, mobile 390px, keyboard, screen-reader, mixed-direction content, forms/charts, session continuity or per-tenant user acceptance.
- Root lang=selected locale even for English-fallback body text: independent AT review and per-string language annotations remain required.

## Release blockers
- TEBE full integration tests and pnpm high-severity dependency audit were failing in inspected pre-release CI, unrelated remediation ownership must be assessed; never waive.
- CI source/Types/tenant-isolation pass is not proof of full end-to-end functionality.
- Keep current backend REST/API/schema/enum/export contract and payment-provider rollout unchanged.
- Do not merge, deploy or call this complete until translation coverage, independent browser acceptance and all mandatory security/integration gates pass.

## Evidence
- Draft PR https://github.com/2029TEBE/TEBE/pull/442
- Coordination https://github.com/2029TEBE/TEBE/issues/452 and https://github.com/2029TEBE/TEBE/issues/451
