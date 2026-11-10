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
