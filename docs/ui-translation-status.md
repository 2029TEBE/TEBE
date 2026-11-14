# UI translation candidate — incomplete, do not deploy

The public TEFE website is translated separately and published through PR #32.
The app's English consolidation is isolated in PR #489.

This candidate adds generated static product-copy catalogs to the shared contracts
and web application, preserving existing reviewed Arabic and regional labels.
It connects explicitly marked JSX labels and attributes to the selected locale.
Customer fields, credentials, form values, tenant permissions and API data are not
sent for translation. No runtime translation service or new paid plan is enabled.

Coverage: 1,439 source entries per non-English locale; 20,340 translated entries
are saved and 9,879 remain missing across the 21 catalogs. Detailed missing keys
are in translation-coverage.json. Arabic, German and Brazilian Portuguese have
complete entries for this inventory. Native-language review remains advisable.
The other languages retain a visible incomplete-translation notice.

Cloudflare Workers AI exhausted its daily 10,000-neuron free allocation during
translation. Do not treat missing entries as complete or copy English into them.
Resume against the missing-key report after the allocation renews, or use an
explicitly authorized translation service. No billing upgrade was performed.

Run `node scripts/check-ui-translation-coverage.mjs --strict` before declaring the
application translation-complete. This deliberately fails until all entries exist.
Run the normal web/contracts typechecks and locale tests after catalog changes.
The contracts .ts catalog and web .mjs catalog must remain identical.

Separate remaining work: complete dynamic enum/attribute coverage and browser
acceptance for every app screen. Document exports remain EN/AR-only under the
existing export-language contract; they are not represented as multilingual.
The English-only selector PR is blocked by GitHub Actions account billing/spend
limits, which prevented its hosted jobs from starting at all.
