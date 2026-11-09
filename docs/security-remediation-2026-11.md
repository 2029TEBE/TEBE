# Dependency security remediation — 9 November 2026

This is an implementation playbook, **not** an assertion that the advisories have been fixed.
Keep `pnpm audit --audit-level high` enabled; never downgrade or suppress the CI security gate.

## Verified baseline

The GitHub Actions audit on the `main` baseline reported **67 advisories**: **2 critical**, **25 high**, **31 moderate**, **9 low**. These existed before intelligence PRs #453, #454, #455.

Critical advisories from the audit:

- `next`: [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) — affected <=15.5.27, fixed >=15.5.28 in the Next 15 release line. Confirm latest vetted 15.5.x patch before upgrading.
- `proxy-addr`: [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) — transitively via `@nestjs/platform-express -> express`; fixed >=2.0.8.

Additional high severity findings include `drizzle-orm` (identifier injection; fixed >=0.45.2), `multer` (multiple request-teardown/DoS issues; some require >=2.5.0), plus other transitive packages. The installed `pnpm-lock.yaml`, not only package.json ranges, determines the deployed package versions.

## Safe upgrade sequence (clean checkout, Node 22, pnpm 10.17)

Use a **new** security remediation branch from the then-current `main`. Verify no other uncommitted work.

```bash
corepack enable
corepack prepare pnpm@10.17.0 --activate
pnpm install --frozen-lockfile
pnpm audit --audit-level high
# First address the Next 15 critical advisory without jumping Next major:
pnpm --filter @pmo/web add next@15.5.29
# Update the lockfile together with the manifest.
# For Express/proxy-addr, Multer and Drizzle: inspect the installed graph and
# choose compatible patched upgrades; do not use broad --force overrides.
pnpm why proxy-addr
pnpm why multer
pnpm why drizzle-orm
pnpm why sharp
pnpm audit --audit-level high
```

`drizzle-orm` is used in both `apps/api` and `packages/db`. Upgrade consistently and verify schema typechecking, SQL-ledger migrations, RLS, and seeded database isolation before deciding the upgrade is safe. Nest/Express/Multer may need coordinated major-version changes; investigate compatibility first. Do **not** treat editing a single transitive version string in the lockfile as a tested fix.

## Required acceptance commands

```bash
pnpm install --frozen-lockfile
pnpm build:packages
pnpm typecheck
pnpm verify:rls
pnpm check:data
pnpm test
npm run test:offline
pnpm --filter @pmo/web build
pnpm audit --audit-level high
```

Integration/RLS tests require the repository's disposable PostgreSQL and Redis CI services. Run the full `.github/workflows/ci.yml` and staging web smoke; verify signed-in tenant separation, workbook upload/rejection, image routes, and production Docker images. Do not use synthetic success logs or mark skipped checks as passed.

## Promotion policy

- Security audit must pass or any residual advisory must undergo independently approved, documented risk acceptance; do not silently filter it.
- Do not merge or deploy this playbook as evidence of remediation.
- Do not merge intelligence PRs #453–#455 or fix PR #456 based solely on this documentation.
- Do not deploy to `app.theepmo.com` without explicit deployment approval.
