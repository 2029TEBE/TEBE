# THE EPMO — multilingual bulk audit (10 November 2026)

## Verified architecture and changes on draft branch
- TheOrg reference: 23 Chromium runtime locale variants representing 19 language families. These are locale identifiers, not complete application translations.
- Shared `@pmo/contracts` registry and frontend selector recognize the same 23 variants. Arabic and Urdu are RTL. English fallback is explicitly shown for incompletely translated languages.
- Existing EN/AR backend document output remains intact; no unsupported 19-language export claims.
- Removed the redundant `LangToggle.tsx`.
- Migrated 35 navigation entries, 15 login labels, appearance strings, breadcrumbs, onboarding copy, 66 billing labels, 50 super-admin labels, and 26 settings labels into shared translation data.
- Added number/date/currency formatting, bidirectional direction resolution, placeholder integrity and coverage assertions.
- Existing legacy `pmo_lang` remains a compatibility bridge while `pmo_locale` is the frontend preference.

## Still open
1. The marketing site currently uses static `data-ar` HTML attributes and a separate `MARKETING_TRANSLATIONS` JavaScript catalog. Cross-repository translation packaging is not unified.
2. The remaining dashboard pages and some components still contain embedded Arabic. Do not claim removal of all hard-coded strings.
3. German, French, Japanese, Simplified Chinese catalogs are partial. Other TheOrg languages lack verified product translations, even though locale selection and formatting work.
4. Backend notifications, API errors, mail templates, DOCX, PPTX, PDF and Excel outputs are not translated into 19 languages.
5. Provider-specific checkout code, tenancy, permissions, emails and database migrations are not part of this localization cleanup.
6. Production rollout, live browser checks and screenshot acceptance remain outstanding.

## Safety / merge gates
- Require green source/audit/typecheck/test checks and frontend site validation before merging.
- Cloudflare has an additional Worker Git integration previously identified as not fully verified. Do not merge or deploy marketing PR #23 until its build trigger is confirmed safe.
- Backend repository CI builds/tests only according to current project records; do not assume merging publishes a production release.
- Never delete historical migrations, credentials or audit evidence as part of translation cleanup.
- Maintain bilingual legacy exports and existing tenant-aware authorization semantics.

## Further testing
- Translate the same page in every locale, including browser refresh and saved-cookie paths.
- RTL: Arabic and Urdu; mixed bidirectional identifiers, numbers and email addresses.
- Export: en/ar file content and filenames, fail closed for unsupported formats until translations are verified.
- Arabic and English current customer journeys; locale fallback notices for other languages.

## Subsequent bulk pass
- Added automated audit of shared navigation translation coverage for all 23 locale variants; CI now prints actual counts and prevents false claims of translation completion.
- Migrated onboarding and reports' additional literal bilingual phrases (22 entries) into shared contracts.
- Migrated 71 literal bilingual page phrases across activity, benefits, decisions, documents, financials, my-work, notifications and portfolios into the shared `page-locale.ts` catalog; reviewed logic remains unchanged.
- Separated Urdu RTL layout direction from Arabic text selection in the application shell and breadcrumbs.
- Added regression checks to prevent migrated files reverting to inline literal Arabic ternaries.
- Public frontend added catalog aliases for reviewed DE/FR/JA translations, plus marketing 23-variant/RTL validation in CI.
- Some complex in-file Arabic expressions, marketing HTML `data-ar`, and backend document/export language limitations remain. This document does not assert full localization completeness.

## Current bulk follow-up (10 November 2026)

- Confirmed earlier PR #483 source checks, audit and full verification all passed before this new batch; marketing PR #23 validation passed.
- Centralized presentation-only document, benefit, work, and portfolio status labels in `packages/contracts/src/status-locale.ts`, preserving status codes used by backend and access controls.
- Migrated the remaining inline Arabic labels/variable text from `benefits`, `documents`, `my-work`, `portfolios`, `financials`, and the getting-started trial message. Arabic templates now use named placeholders (`{pct}`, `{count}`, `{days}`) and shared formatting.
- Defined **reviewed export languages** separately from supported UI locale identifiers. Board pack exports accept legacy English/Arabic and en-US/en-GB/ar-SA aliases, but explicitly reject other requested locales instead of silently producing English files.
- Added CI regression assertions covering migration, status labels, placeholders and strict export language behavior.
- Untranslated interface screens, email/notification templates, marketing HTML, and non-EN/AR backend reports remain open. These are not marked translated or production-ready.

CI result for this exact revision must be checked separately from earlier successful commits.

## Account-flow and locale-parity audit extension (10 November 2026)
- Audited frontend password recovery, password reset and invitation acceptance pages and their three client forms. Moved five server-page Arabic labels into shared contract catalog and 23 existing form phrases into **screen-specific** shared catalogs, preserving the differing Arabic wording of the same English password label in separate contexts.
- Removed inline Arabic display text from the three server pages and three account forms, without changing form submission endpoints, authentication decisions, bearer-token fragments, or immediate URL-history scrubbing.
- Fixed the password-recovery, password-reset and invitation landing-page inner `dir` attributes to retain RTL for Urdu independently of Arabic text selection.
- Removed remaining inline Arabic from the universal language switcher and authenticated shell, using the shared Arabic navigation catalog instead.
- Added regression checks for zero inline Arabic in those migrated files, token safety, and exact parity of the frontend's 23 locale codes against the shared contract's 23 entries.
- **Do not infer 19 fully translated experiences.** Translation catalogs are still incomplete; non-English/non-Arabic interface copy may fall back to English. Marketing frontend PR #23 is still a separate distribution.
- Latest commit's full build/CI result is separately tracked in GitHub; prior green jobs cannot verify a newer head.

## Regional locale normalization follow-up (10 November 2026)
- Existing PR #483 head `f50ce0a` had a successful GitHub CI run before these changes. Marketing PR #23 head `d6206529` likewise passed marketing validation; both PRs remained drafts.
- SaaS frontend locale resolution now preserves `en-GB`, `es-419`, `pt-BR`, and `pt-PT` when browser locale tags include supported extension subtags, instead of inadvertently collapsing `en-GB-*` to `en-US`.
- Added regression assertions in `apps/web/src/lib/frontend-locale.test.mjs` for regional locale extensions and preference selection.
- Changes committed on existing draft PR #483 as `e443492` and `aae15b8`. Latest CI result must be obtained from GitHub before treating the new head as passing; no deployment or merge was performed.
- GitHub connector permissions: write/admin on SaaS repository; read-only on marketing repository. Marketing source cannot be updated through this connection without write permission.
- This is a targeted normalization fix, not completion of catalog sharing, full 19-language translation coverage, localized exports, device acceptance, or production verification.

## Additional safe implementation batch — 10 November 2026

### Applied on SaaS draft branch
- Frontend locale normalization retains regional browser variants with Unicode or other additional subtags; six assertions added in `frontend-locale.test.mjs`.
- `uiLabel` now falls back to the English source when a candidate translation is blank, non-string, or loses, renames, or duplicates interpolation placeholders. Existing Arabic text still takes precedence when valid.
- Added regression coverage for malformed Arabic placeholders and a full `UI_LABELS` catalog validation test for placeholder parity and non-empty translation values.
- Updated files: `apps/web/src/lib/frontend-locale.mjs`, `frontend-locale.test.mjs`, `ui-labels.mjs`, `ui-labels.test.mjs`.
- Implementation commits: `e443492`, `aae15b8`, `a6f0eb9`, `df23299`, `f17cb13`. A previous audit-only commit was `b9aa633`.
- No merges, production deployment, DNS, payments, customer databases, or mail infrastructure changes.
- CI results must be evaluated against the final head, not earlier green runs; commit creation is not test evidence.

### Still not completed
- All-locale translation coverage, shared marketing/SaaS catalog artifact, backend emails, API messages, exports beyond EN/AR, accessible responsive RTL browser acceptance, release trigger verification.
- Marketing repository `2029TEFE/TEFE` is only readable via the current GitHub connection, preventing authorized write operations.
- Status: partial implementation, draft-only; do not mark 100% completion or production ready.

## Auto-approved safe batch — additional verified development scope (10 November 2026)

- Commit `c4df44c`: invalid `pmo_locale` cookies now defer to the legacy `pmo_lang=ar` preference instead of unexpectedly reverting Arabic users to English.
- Commit `9a796b1`: regression guard for invalid new cookie and legacy compatibility.
- Commit `23c14f4`: adds `scripts/i18n-inline-inventory.mjs`, a non-blocking count-only scanner for candidate inline Arabic and language branches in web/API source files. It emits file paths and candidate counts, never customer data or source snippets.
- Commit `291070c`: offline regression test verifies inventory JSON is count-only, coherent and clearly labelled non-certifying.
- **Audit limitation:** The inventory detects candidates, not proven UI text. Translation catalogs, comments and genuine data may still be counted. Its counts must not be interpreted as quality or completion percentages.
- PR #483 is still draft; external marketing PR #23 is read-only to this connection. Existing high-level blockers remain: 19-language review, public/SaaS catalog distribution, backend exports/emails, mobile/RTL browser acceptance and Cloudflare release-trigger verification.
- The latest branch-head CI status must be checked independently; earlier successes do not certify these commits. No production release or merge performed.

## Auto-approved bulk batch: regional normalization and public catalog candidate

Changes committed to the existing SaaS draft branch:
- `55c8d86`: preserve Chinese territory/script selection for browser subtags (Traditional `zh-TW`, `zh-HK`, `zh-MO`; Simplified `zh-CN`, `zh-SG`).
- `fdccf65`: regression coverage for Chinese territory and script extensions.
- `3c695a5`: deterministic public-only UI catalog candidate builder with explicit `releaseApproved=false` and `coverage=partial` metadata; SHA-256 digest; no backend source or tenant data included.
- `7898776`: test public artifact reproducibility, locale inventory, hash consistency and intentional omission of untranslated values.
- `828a13b`: portable CLI path handling for the builder.
- `561d278`: documentation for a safe cross-repository adoption process, verification and release gates.

This work is a **preparatory public catalog artifact**, NOT a single physically shared catalog in both running repositories. Marketing PR #23 remains read-only through the current connection. No release, merge, production backend, mail, DNS or customer data changes.

**Completion evidence:** Commit and source file existence are verified. The latest commit's CI result must be checked separately before listing these items as passing CI. English fallback and EN/AR backend export safety remain unchanged.

## Auto-approved follow-up — public artifact integrity validation

- `98b2b62`: adds `verifyPublicLocaleCatalog(document)` for candidate compiled UI catalog artifacts. The verifier rejects invalid schema, mismatched locale lists, malformed placeholders, incorrect digests, unknown translation locale keys and unapproved release status changes.
- `ee43992`: adds negative tests for tampered translations, modified locale registry, false approval flags, unknown locale keys and missing input.
- The SHA-256 checksum is a **transport integrity check, not publisher authentication or proof of editorial approval**. A trusted CI source and pinned revision remain required.
- The artifact still contains only partial reviewed UI labels and is NOT a fully shared catalog or published deployment. Marketing TEFE #23 is still a separate draft and cannot be edited from the current read-only connection.
- Source checks and full verification must be rerun for the final head; do not infer their result from earlier green builds. No production changes were authorized or executed.

## Auto-approved draft batch — public exposure reduction and typed semantic keys

- `4e513ee`: public localization build now uses an explicit allowlist of 17 low-risk navigation/accessibility labels, rather than exporting all enterprise dashboard UI copy. This is a public-content minimization control, not a claim that the artifact has been published.
- `ea22163`: public catalog tests enforce exact allowlist membership and absence of internal executive-dashboard narrative keys.
- `43ffb6b`: typed semantic label registry in shared contracts; English source maps to previously reviewed Arabic navigation translations, avoiding parallel Arabic catalogs for this initial vocabulary.
- `3f5095a`: semantic contract exported from `@pmo/contracts`.
- `912796f` and `5158be5`: semantic-key tests added and adjusted for the repository's existing offline test runtime.
- Only 17 semantic display keys have been introduced; the rest of the application still uses existing legacy English-string and domain-catalog interfaces. No claim of full semantic-key migration or 19-language coverage.
- Source guards and dependency audit passed for `5158be5` in run `42815461645`; full verify was still running at the time of this audit entry. Later commits require separate CI verification.
- No deployment, merge, customer data, production configuration or billing change was performed.

## Auto-approved bulk batch — public catalog validation and measured coverage

- Commit `d68252c`: rejects unexpected public catalog source keys, missing allowlisted keys, altered source metadata and extra top-level fields even when a digest has been recomputed. Hash integrity remains distinct from publisher authentication.
- Commit `22d725e`: negative tests covering rehashed additions, deletions, and unapproved metadata.
- Commit `fb1f654`: creates a machine-readable **23-locale, public-label-only** coverage report linked to the candidate catalog digest. Never treats registered locales or English fallback as complete product translations.
- Commit `a29ce83`: coverage assertions for every locale, English source tracking and untranslated Swahili fallback.
- GitHub run `42816009364` for `a29ce83`: dependency-free source tests and dependency audit succeeded; full integration verification was still running when checked.
- All changes are in SaaS draft PR #483. Marketing draft PR #23 remains read-only for the connected account. The physically shared catalog consumption, 19 complete locale reviews, backend emails/exports, RTL browser acceptance and production gates remain unimplemented or unverified.
- No merge, production deployment, live tenant mutation, secret change, DNS or mail adjustment.
