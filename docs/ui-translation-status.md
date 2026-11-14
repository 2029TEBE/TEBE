# THEEPMO application localization — bulk pass, still not release complete

**Status: DRAFT / NO-GO for a claim of complete multilingual localization.** This app work is stacked on [TEBE PR #489](https://github.com/2029TEBE/TEBE/pull/489). Public Orgaiz/TEFE marketing translations remain separate.

## Evidence-based inventory (15 November 2026)

- English: one default `en-US`; English is the source catalog, not a separate generated translation.
- 1,439 distinct inventoried static UI strings per non-English locale; 21 non-English locale catalogs (30,219 required entries).
- **20,785 populated entries; 9,434 remain missing; 68.78% static-entry coverage.**
- **11 catalogs populated for the current static inventory:** `ar`, `de`, `es`, `es-419`, `fil`, `fr`, `id`, `it`, `ko`, `pt-BR`, `pt-PT`.
- **10 catalogs still missing entries:** `bn` 230, `hi` 210, `ja` 277, `ru` 250, `sw` 1,420, `tr` 1,420, `ur` 1,420, `vi` 1,420, `zh-CN` 1,367, `zh-TW` 1,420.
- Work in this bulk pass filled **338 additional source-keyed static entries**, covering `id` 41, `fr` 77, `it` 55, `fil` 61, and `ko` 104. The preceding repair filled 107 entries (4 Spanish, 23 Latin-American Spanish, 80 European Portuguese), so PR #490 is now **445 entries ahead of its original 9,879-gap candidate**.
- `es-419` still contains 23 borrowed `es` entries; `pt-PT` still contains 80 borrowed `pt-BR` entries. All need regional/native review.
- **"Catalog populated" does not equal "fully localized":** some already-populated entries retain English technical terms, product names, and suspected untranslated phrases. Machine-generated and manually drafted copy requires native review. The explicit inventory is not every app message, validation string, dynamic enum, or export.

## Safety and scope

Only published UI/product-copy source strings are translated. Do not translate live tenant data, credentials, user input, audit records, API payloads, project names, signed approvals or uploaded customer documents. English is the source. Preserve named interpolation tokens and markup. Do not alter server auth, RLS, plans or exports.

Document export remains EN/AR-only. Neither the status of these catalogs nor the presence of a locale option proves that a localized report/export exists. The public website and authenticated app are different repositories.

## Free, offline continuation workflow

Two no-network helper commands are included in this PR.

```sh
# List remaining gaps, smallest catalog first
node scripts/export-ui-translation-batch.mjs

# Export the next 50 source strings as JSON with empty values
node scripts/export-ui-translation-batch.mjs --locale hi --offset 0 --limit 50 > /tmp/hi-source-batch.json

# After translations are written/reviewed, dry-run and then apply:
node scripts/import-ui-translations.mjs /path/to/reviewed-hi.json
node scripts/import-ui-translations.mjs /path/to/reviewed-hi.json --apply

# Verify generated artifacts, placeholders, coverage, regression tests
node scripts/check-ui-translation-coverage.mjs
node scripts/audit-ui-translation-quality.mjs
node --test tests/generated-ui-translations.test.mjs apps/web/src/lib/ui-labels.test.mjs
node scripts/check-ui-translation-coverage.mjs --strict
```

- `export-ui-translation-batch.mjs` exports only missing source-keyed static strings; no personal data or translation call.
- `import-ui-translations.mjs` refuses unknown keys/locales, missing values, broken markup/placeholders, and silent overwrites. `--apply` is required to modify catalog files. Native review is necessary before `--apply`.
- `audit-ui-translation-quality.mjs` reports suspected English-identical entries for **human review**, allowing legitimate proper nouns/technical words. It is not a translation engine and cannot certify quality.
- Contract/frontend catalogs and `translation-coverage.json` are generated and synchronized. No paid service or cloud provider translation API was used in this pass.

## Required merge and release gates

1. Complete genuinely translated strings for **all remaining 9,434 catalog gaps**. `node scripts/check-ui-translation-coverage.mjs --strict` deliberately fails until all gaps are filled; do not fake completeness by duplicating English source strings.
2. Native-language review including regional variants, product terminology, HTML entities, long-form copy, role/access wording and any machine-generated earlier translations.
3. Coverage for dynamic enums/messages, forms, accessibility and responsive layouts, authenticated role-specific screens, locale persistence, and Arabic/Urdu RTL.
4. Validate number/date/currency formatting, links, technical placeholders and correct backend EN/AR export behavior.
5. Reconcile the dependency on PR #489 and pass actual local and hosted CI before merging. GitHub Actions for the latest branch has reported failures **with no steps** in the job summaries; workflow logs could not be retrieved (`BlobNotFound`). This is consistent with the earlier repository note about Actions billing/spending constraints, but no root cause is confirmed. Do not claim tests passed on GitHub until verified.
6. Obtain separate approval and verify staging/browser acceptance before any production deployment or redirect.

**No production deployment or subscription purchase was performed.**
