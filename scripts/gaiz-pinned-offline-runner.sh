#!/usr/bin/env bash
# Dedicated, non-root, isolated checkout. No GitHub Actions, Docker or database.
set -Eeuo pipefail
umask 077
if (( EUID == 0 )) || [[ $# != 1 || ! $1 =~ ^[a-f0-9]{40}$ ]]; then
  echo 'Usage (non-root): bash scripts/gaiz-pinned-offline-runner.sh <40-char commit SHA>' >&2; exit 2
fi
expected=$1
[[ $(node -p 'process.versions.node.split(".")[0]') == 22 ]] || { echo 'Node 22 required' >&2; exit 2; }
command -v git >/dev/null; command -v flock >/dev/null; command -v timeout >/dev/null
[[ -n ${HOME:-} && -d $HOME ]] || exit 2
mkdir -p "$HOME/gaiz-validation-results"
exec 9>"$HOME/gaiz-validation-results/.lock"
flock -n 9 || { echo 'Another validation is running' >&2; exit 2; }
tmp=$(mktemp -d "${TMPDIR:-/tmp}/gaiz-offline-XXXXXXXX")
trap 'rm -rf -- "$tmp"' EXIT
mkdir -p "$tmp/home"
exec > >(tee "$HOME/gaiz-validation-results/$expected-$(date -u +%Y%m%dT%H%M%SZ).log") 2>&1
echo "Checking commit: $expected (UTC $(date -u -Is))"
GIT_TERMINAL_PROMPT=0 timeout 120 git clone --no-checkout --quiet git@github.com:2029TEBE/TEBE.git "$tmp/repo"
cd "$tmp/repo"
GIT_TERMINAL_PROMPT=0 timeout 60 git fetch --quiet origin refs/heads/feat/gaiz-auth0-provider-candidate-20261116
git cat-file -e "${expected}^{commit}"
git -c advice.detachedHead=false checkout --quiet --detach "$expected"
[[ $(git rev-parse HEAD) == "$expected" && -z $(git status --porcelain --untracked-files=all) ]] || exit 2
for path in .env .env.production apps/api/.env apps/api/.env.production; do
  [[ ! -e $path ]] || { echo 'Environment file in checkout; refusing execution' >&2; exit 2; }
done
run(){ timeout 180 env -i PATH="$PATH" HOME="$tmp/home" NODE_ENV=test CI=true "$@"; }
shopt -s nullglob
sources=(apps/api/src/gaiz/*.mjs)
(( ${#sources[@]} > 0 )) || exit 2
for src in "${sources[@]}"; do run node --check "$src"; done
tests=(
  gaiz-verifier gaiz2-fixed-fixture gaiz2-readonly-verifier gaiz2-trust-policy
  gaiz-service-contract gaiz-standalone-oidc gaiz-standalone-login-broker
  gaiz-oidc-provider-policy gaiz-reviewed-provider-broker gaiz-auth0-candidate
)
files=()
for name in "${tests[@]}"; do
  path="apps/api/src/gaiz/$name.test.mjs"
  [[ -f $path ]] || { echo "Required test missing: $path" >&2; exit 1; }
  files+=("$path")
done
run node --test "${files[@]}"
echo 'PASS: GAIZ syntax and ten dependency-free test files at exact SHA.'
echo 'NOT TESTED: TypeScript/Nest build, full CI, PostgreSQL/RLS, live auth, payments, production.'
