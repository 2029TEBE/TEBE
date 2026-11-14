# THEEPMO app UI localization — draft / NOT release complete

**Status: incomplete. Do not merge or deploy PR #490 as translation-complete.**
This translation PR remains stacked on [PR #489](https://github.com/2029TEBE/TEBE/pull/489), which consolidates the default English locale. The public Orgaiz/TEFE website is separately owned and outside this PR.

## Static-copy inventory (2026-11-15)

- English: one default (`en-US`) from PR #489; English is the source, not an additional generated catalog.
- 1,439 explicitly inventoried static strings per non-English locale across 21 catalogs.
- **9,772 missing catalog entries** remain. See `translation-coverage.json` for every language and missing source string.
- **Six catalogs have 1,439/1,439 static entries:** Arabic (`ar`), German (`de`), Spanish (`es`), Latin-American Spanish (`es-419`), Brazilian Portuguese (`pt-BR`), and European Portuguese (`pt-PT`).
- Spanish gained **four newly translated strings** with verified named placeholders.
- `es-419` gained **23 entries borrowed from existing Spanish** and `pt-PT` gained **80 borrowed from existing Brazilian Portuguese**. **These 103 regional entries still require native-language regional review and should not be described as regionally approved.** No provider or billing service was invoked.
- Fifteen catalogs remain partly translated. The UI may fall back to English where entries are missing, and must continue displaying its incomplete-translation notice. Do not hide remaining gaps by inserting English copies.
- Catalog entry count is **not** equivalent to full application localization or release acceptance. The explicit static JSX inventory does not cover every dynamic enum, runtime message, validation string, report or third-party interface. Exports remain supported only in English and Arabic.

## Safe offline continuation

An approved reviewer may prepare a JSON file containing *only static public product copy*:

```json
{
  "fr": {
    "Benefit": "Avantage"
  }
}
```

Run a dry run first; the script has **no network or paid API calls**:

```sh
node scripts/import-ui-translations.mjs /path/to/reviewed-ui-copy.json
node scripts/import-ui-translations.mjs /path/to/reviewed-ui-copy.json --apply
node scripts/check-ui-translation-coverage.mjs
node --test tests/generated-ui-translations.test.mjs apps/web/src/lib/ui-labels.test.mjs
```

The importer refuses unknown locales or source keys, broken placeholders/markup, English-copy substitutions and accidental overrides. Use `--replace` only for expressly reviewed improvements, and `--allow-identical` only where the original product/brand terminology correctly remains identical. It updates frontend and contracts generated catalogs plus `translation-coverage.json` together. Verify diffs before committing. Never import user credentials, tenant data or live content.

## Release gates

1. `node scripts/check-ui-translation-coverage.mjs --strict` **must pass with zero gaps in every offered locale**. It currently deliberately fails. The normal checker also verifies frontend/contracts parity, report freshness, placeholders and catalog set.
2. Confirm native review, particularly the 103 borrowed regional strings and any machine-generated translations; accept approved official product terminology. The six filled catalogs are *inventory-complete*, not native-QA-complete.
3. Audit dynamic enums, messages, date/number formatting, accessibility labels, placeholders and responsive rendering for each supported locale. Verify Arabic/Urdu RTL without changing tenant data or form entries.
4. Verify existing English/Arabic document-export contracts. Do not market multilingual exports as delivered.
5. Confirm PR #489's locale/default behavior and merge strategy; rerun normal typechecks, locale tests and GitHub Actions on the actual PR merge commit. Prior CI reports indicate GitHub account billing/spending restrictions, while current job log downloads return `BlobNotFound`; treat hosted CI as **unverified** until a new successful run is observed.
6. Preserve authentication, RLS, authorization, existing user locale preferences and product privacy. No production deployment or paid translation plan is approved by this PR.

## Targeted checks

Use local/approved Node tests; these commands are not evidence the hosted runner executed:

```sh
node scripts/check-ui-translation-coverage.mjs --released
node scripts/check-ui-translation-coverage.mjs --strict
pnpm --filter @pmo/web typecheck
pnpm --filter @pmo/contracts typecheck
```

The `--released` check only confirms that at least one catalog is fully populated; it does **not** certify release readiness. The stricter checker must pass before declaring all supported UI locales complete.
