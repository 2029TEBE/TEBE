# THE EPMO — one application, six locale interfaces

Reference: TheOrg Electron `locales/*.pak` package. Its resource directory is a useful example of organizing locale identifiers, but those binary Chromium runtime files are **not** product translations and must not be copied into the browser application.

## Supported locales
- `en` — English; canonical authoring language; LTR
- `ar-SA` — Arabic (Saudi Arabia); RTL
- `de-DE` — German; LTR
- `zh-CN` — Simplified Chinese; LTR
- `fr-FR` — French; LTR
- `ja-JP` — Japanese; LTR

## Existing compatibility boundaries
- `apps/web/src/lib/frontend-locale.mjs` is the locale normalization/resolution boundary.
- `UniversalLocaleSwitch` is the **only active** selector in the authenticated shell.
- Cookie `pmo_locale` is authoritative; legacy `pmo_lang` remains an EN/AR export compatibility bridge during migration.
- `@pmo/contracts` currently maintains the EN/AR dictionary consumed by API exports. It must remain untouched until six-language export acceptance is complete.
- `ui-labels.mjs` is a partial frontend catalog and is not proof of complete translations.
- `locale-format.mjs` provides six-locale presentation formatting without modifying stable IDs, API values or database records.

## Completion gates (not yet satisfied)
1. Extract stable namespaced translation keys and complete all six UI catalogs, with parameter/plural validation.
2. Introduce server/client unified translation adapter and include login, onboarding, administration, errors, data tables and emails.
3. Verify RTL and bidirectional numbers/identifiers, keyboard navigation, all breakpoints and screen-reader labeling.
4. Add six-locale document-export integration tests before changing backend export language behavior.
5. Enforce a missing-key and translation-coverage release gate before claiming the six locales complete.
6. Do not change tenant identity, RBAC, billing, migrations or production DNS as part of localization cleanup.

Unused-file policy: remove only code proven unreferenced. Historical migration SQL and audit artifacts are not safe to delete merely because their names refer to a previous feature.
