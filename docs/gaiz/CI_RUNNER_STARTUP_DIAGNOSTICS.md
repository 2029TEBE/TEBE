# GAIZ CI runner startup investigation (2026-11-16)

Status: **blocked before first workflow step**, not a confirmed test failure.

## Evidence

- Draft PR: https://github.com/2029TEBE/TEBE/pull/507
- CI run: https://github.com/2029TEBE/TEBE/actions/runs/43875186399
- Three jobs (`Dependency-free source checks`, `verify`, `audit`) reported failure but had **zero recorded steps**.
- Each job-log retrieval returned 404 `BlobNotFound`.
- Rerunning the failed dependency-free source-check job also produced failed jobs with **zero steps** (new job IDs 133327747546, 133327750265, 133327750427).
- The minimal runner probe run https://github.com/2029TEBE/TEBE/actions/runs/43875757063 **also failed with no recorded steps** (job 133328228448). This reproduces the issue without checkout, dependencies, GAIZ code or external actions.
- A minimal, no-dependency runner probe is isolated in
  `.github/workflows/gaiz-runner-probe.yml`. It triggers on PR edits to
  that file only and contains no checkout, third-party actions, secrets,
  external network requests, deployment or database access.

## Interpretation

The minimal repro strongly supports failure during runner scheduling or
initialization (or upstream account/organization restrictions), but it is
**not enough evidence to assign a specific root cause**. Do not attribute it
to GAIZ code, CI YAML, GitHub platform outage or billing without explicit
job annotations or support confirmation.

## Account owner checks (GitHub UI)

1. Open the latest failed Actions run and look for top-of-job banners and
   annotations concerning spending limits, payment or policy.
2. Check **Settings → Billing and licensing** for the relevant account/org:
   Actions budget, spending limits, outstanding payments and quota.
3. Check **Settings → Actions → General** for allowed Actions, repository
   permissions and organizational policy. Inspect any configured runner groups.
4. Compare the minimal GAIZ startup probe with a different repository under
   the same GitHub account (if appropriate); do not change production CI
   requirements to make the problem disappear.
5. If the minimal probe also fails before a step, open
   https://support.github.com/ with PR/run/job IDs, UTC timestamps,
   zero-step job descriptions and `BlobNotFound` responses.

Do not auto-approve, merge, deploy or weaken branch protection while jobs
cannot execute. The next required evidence is a successful minimum runner
probe followed by successful normal CI on the exact PR commit.
