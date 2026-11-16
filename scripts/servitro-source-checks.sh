#!/usr/bin/env bash
# Run from a dedicated, unprivileged checkout on Servitro.
set -euo pipefail

if (( EUID == 0 )) || [[ $# != 1 || ! ${1:-} =~ ^[a-f0-9]{40}$ ]]; then
  echo 'Usage (non-root): bash scripts/servitro-source-checks.sh <reviewed 40-character commit SHA>' >&2
  exit 2
fi

expected_commit=$1
cd "$(git rev-parse --show-toplevel)"
if [[ $(git rev-parse HEAD) != "$expected_commit" || -n $(git status --porcelain --untracked-files=all) ]]; then
  echo 'Check out the requested commit in a clean, dedicated checkout first.' >&2
  exit 2
fi

if [[ $(node -p 'process.versions.node.split(".")[0]') != 22 ]]; then
  echo 'Use Node.js 22, matching the source checks in GitHub Actions.' >&2
  exit 2
fi

lock="$(git rev-parse --path-format=absolute --git-common-dir)/servitro-source-checks.lock"
exec 9>"$lock"
if ! flock -n 9; then
  echo 'Source checks are already running for this checkout.' >&2
  exit 1
fi

check_home=$(mktemp -d)
trap 'rm -rf -- "$check_home"' EXIT
run_check() {
  printf 'Running: %s\n' "$*"
  env -i PATH="$PATH" HOME="$check_home" CI=true npm_config_ignore_scripts=true "$@"
}

run_check node scripts/verify-ci-safety.mjs
run_check bash -n infra/deploy.sh
run_check node scripts/verify-release-static.mjs
run_check node scripts/verify-migration-chain.mjs
run_check node scripts/rc1-release-gate.mjs
run_check node scripts/i18n-coverage-report.mjs
run_check npm run test:offline

shopt -s nullglob
gaiz_tests=(apps/api/src/gaiz/*.test.mjs)
if (( ${#gaiz_tests[@]} )); then
  run_check node --test "${gaiz_tests[@]}"
fi

printf 'Source checks passed for %s\n' "$expected_commit"
