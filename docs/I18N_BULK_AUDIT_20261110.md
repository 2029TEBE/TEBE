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
