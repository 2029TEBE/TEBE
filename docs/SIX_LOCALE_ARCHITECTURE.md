# THE EPMO localization architecture — TheOrg reference

## Current implementation
- Canonical 23-variant registry (`packages/contracts/src/locales.ts`), representing 19 language families.
- Authentication, entitlement, and database logic remain locale-neutral.
- English `en-US`/`en-GB` are source/fallback; `ar` and `ur` display RTL.
- Legacy backend Word/PowerPoint/PDF exports still support only `en` and `ar`; **do not claim 19-language exports**.
- Existing translation catalogs include English, Arabic and **partial** German, Simplified Chinese, French, Japanese. All other selectable languages use explicit English fallback.
- `pmo_locale` is the preferred UI cookie. `pmo_lang` remains as an EN/AR export compatibility bridge.
- `navigationArabic` in shared contracts contains 35 migrated Arabic nav labels. No duplicate Arabic copy remains in `apps/web/src/lib/nav.ts`.
- The marketing site has a parallel registry and pending source-data unification across repositories. The two repositories are NOT yet one physically shared translation bundle.
- TheOrg `.pak` files are Chromium resources, **not** product copy; do not import or distribute them as translations.

## Remaining work before release
1. Extract all remaining inline Arabic presentation strings from the dashboard components into one shared translation catalog.
2. Migrate HTML `data-ar` marketing strings into namespaced catalogs, and share catalog packages across frontend/backend repositories.
3. Supply reviewed complete translations for all 19 languages (23 variants), with ICU messages, plural rules and placeholder coverage.
4. Change all API messages, emails, notifications and document exports to use approved locale-aware templates; keep privileged business logic unchanged.
5. Add translation-completeness checks, untranslated-fallback reporting, RTL visual checks (Arabic and Urdu), and bilingual ID/currency tests.
6. Validate existing legacy cookies and export URLs across the migration.
7. Keep release and Cloudflare delivery off until tests and visual acceptance pass.

## Unused-files rule
Only remove files proven unreferenced. Never delete database migrations, historical audit files or back-compat exports based only on their filenames.
