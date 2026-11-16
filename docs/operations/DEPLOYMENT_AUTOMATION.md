# Permanent deployment process — TEBE

## Implemented path

1. A non-draft same-repository PR gets source, audit and full verification checks.
   The merge evaluator runs on PR/review changes and CI completion, with an hourly
   recovery scan. It requires real SUCCESS for source checks, verify and audit,
   retains hold/review/draft/fork rules and merges only the inspected head SHA.
2. CI on main uses hosted runners; the production Servitro runner is reserved for
   deployments. Superseded CI runs are cancelled, never an active VPS deployment.
3. Cached BuildKit builds produce API/web images once. Existing runtime/tenant/
   restore/application checks remain. Successful main CI exports the exact tested
   images and a manifest binding repository, source commit, CI run, image IDs and
   archive SHA-256. The private artifact expires after two days.
4. Production downloads only that exact successful main CI run's bundle. It checks
   bytes/provenance before SSH, streams Docker's gzip archive over the existing
   pinned SSH connection, tags only verified image IDs and starts with no build or
   pull. Both services must become healthy and run the exact tested IDs before
   deployment success/revision recording. No registry credentials are needed.
5. Backups, migration checks, source snapshots, production environment approval,
   serialized deployment and stale-main rejection stay in place. No automatic DB
   restore is introduced. Roll back using reviewed compatible source/images and
   the protected snapshot; never erase a live DB to make a release look healthy.

The optional manual registry publisher accepts a successful current-main CI run
ID and publishes those same tested images. It does not rebuild different images.
When a bundle has expired, rerun CI on current main; there is no unverified-build
fallback in the new automatic production path.

## Repository settings requiring an authorized administrator

Native auto-merge and delete-merged-branch are already enabled in TEBE. Main was
observed unprotected during this audit. Set required status checks for
`Dependency-free source checks`, `verify` and `audit`, require an up-to-date main
base, disallow force pushes/deletion and require resolved conversations. Preserve
any stricter review/CODEOWNERS rules. Do not mark skipped checks as successful or
permit an admin merge to bypass failed checks. These owner settings are not
changed merely by committing this document.

## Direct Git CLI authentication (one account at a time)

The connected GitHub API can commit, but the local Git CLI has no authenticated
GitHub host. A repository writer must complete GitHub's browser/device login:

```sh
gh auth login --hostname github.com --git-protocol https --web
gh api user --jq .login   # confirm the intended account before continuing
gh auth setup-git --hostname github.com
git push --dry-run origin HEAD
```

For this repository use the authorized 2029TEBE account. Never paste access tokens,
SSH private keys or passwords into chat, source or workflow files. Do not switch
accounts midway through the repository. TO/TEFE owner-only settings require their
respective administrator permissions in a subsequent account session.

## Validation scope

Bundle/merge policy and the real deploy shell path are exercised locally with
synthetic archives and isolated fake SSH/Docker commands. Tests ensure corrupt or
wrong-run bundles fail before SSH; valid bundles never rebuild/pull and preserve
backup/migration/health/image checks. Full CI and the first real bundle deployment
must succeed before this automation is reported operational. Local tests alone
are not evidence of a completed production deployment.
