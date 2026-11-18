# Dependency security gate

Run from the checked-out TEBE repository on a local development server or CI:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm audit:security
```

The `pnpm` executable on PATH must match `packageManager` (10.17.0). Enable the Corepack pnpm shim, or otherwise install that exact version. pnpm 11 ignores this repository's `package.json` overrides; do not regenerate the lockfile with a different major version.

The gate audits the full dependency tree, including development tools, at the existing high/critical threshold. It confirms each blocking GHSA against GitHub's public advisory API. Only an advisory with a matching ID and a valid past `withdrawn_at` timestamp is classified withdrawn. There is no permanent ignore list. Active advisories, missing IDs, unavailable verification, invalid reports, and registry failures block. A withdrawal that is reversed blocks on the next check.

Evidence is written to `$RUNNER_TEMP/tebe-dependency-audit` in CI and `/tmp/tebe-dependency-audit` locally. Set `DEPENDENCY_AUDIT_DIR` to choose another local destination. CI uploads both the original registry report and the dated assessment. Lower-severity findings remain visible in the original report for follow-up.

## Incident, 18 November 2026

CI run 44327883195 failed on two dependency paths covered by GHSA-fc5q-39xc-vjpf (`picomatch`, through Vite and Nest CLI/chokidar). Both builds and verification passed. A fresh audit rerun continued to report the advisory after GitHub withdrew it at 15:38:56 UTC (18:38:56 Riyadh). The registry response was lagging the authoritative withdrawal, so changing dependency versions could not resolve that report: it listed no patched version.

Sources:
- https://github.com/2029TEBE/TEBE/actions/runs/44327883195
- https://github.com/advisories/GHSA-fc5q-39xc-vjpf
- https://api.github.com/advisories/GHSA-fc5q-39xc-vjpf
- https://github.com/micromatch/picomatch/pull/235#issuecomment-6315749381

This command does not expose a local web endpoint, install a service, mutate production, or upgrade dependencies. Apply the repository change before running it on the actual local server. Do not expose development servers to untrusted networks or allow untrusted users to supply glob patterns.
