# GAIZ Executive Brief PDF — draft release handoff

**Scope:** Implement GAIZ's first PDF report format, with payments fully deferred.

- `gaiz-executive-brief-pdf.mjs` generates a deterministic A4 PDF from the *same bounded* Executive Brief data shape as the existing HTML renderer: title, findings and recommendations. Built with Node built-ins and standard PDF Type 1 fonts; no external browser, browser scripts, network, shell, dynamic imports or external code.
- Only plain printable ASCII is supported in this first safe PDF version. Unsupported Unicode input, including Arabic, **fails visibly** rather than producing missing glyphs. Production multilingual PDF export must use reviewed embedded fonts, shaping/RTL, font licensing and visual regression tests.
- The page writer escapes PDF literal-string special characters, wraps bounded text, paginates long lists and limits output to 2 MB. This is an initial minimal typeset report, not a full branded analytics PDF with charts.
- `gaiz-executive-brief-handlers.mjs` exports a fixed allowlisted dispatcher for HTML and PDF; GAIZ2 output is still blocked pending signing/encryption/key-management review. **The dispatcher is not registered or scheduled in production.**
- `gaiz-executive-brief-pdf.test.mjs` has five focused tests: valid PDF structure, deterministic escaping, invalid/unsupported input, pagination and wrong tool/format. The equivalent local source was tested with Node v22 and all five passed. A sample PDF was rendered and visually inspected with Poppler, showing the expected headings, findings and recommendations.

## Release blockers

1. This PR is stacked on #531 and upstream #529, #528, #527 and #526. It is draft-only; no merge, production API activation, payment/billing change, database migration or deployment.
2. The report worker must be integrated with reviewed PostgreSQL job-claim/lease, settlement-backed entitlement, RLS and private storage. No fake payment flag or customer entitlement is permitted.
3. A real private encrypted storage mount/key, retention, backup/restore and revocation-safe downloads must be verified in staging.
4. Add embedded Unicode fonts, RTL and Arabic shaping before claiming multilingual PDFs. Validate output by rendering to images and checking text extraction/accessibility.
5. Add real integrated concurrency/worker/storage/customer/auth/HTTP tests; run the full GAIZ and TEBE CI suites and security review before release.
6. For complex reports, charts and advanced design, adopt a reviewed PDF engine with bounded resources and an explicit isolated worker policy; do not enable unbounded browser HTML rendering from user inputs.

## Local checks

```sh
node --test apps/api/src/gaiz/gaiz-executive-brief-pdf.test.mjs
```

The focused local tests passed 5/5. Full GitHub CI and integration tests **not verified**.
