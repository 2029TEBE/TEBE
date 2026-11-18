#!/usr/bin/env bash
# Isolated hosted CI only: no production access, registry credentials or bypass.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${RUNNER_ENVIRONMENT:-}" == github-hosted ]] || {
  echo 'BLOCKED: image round-trip verification requires an isolated GitHub-hosted runner' >&2; exit 1;
}
[[ "${GITHUB_SHA:-}" =~ ^[a-f0-9]{40}$ ]]
command -v jq >/dev/null
scratch=$(mktemp -d "$RUNNER_TEMP/epmo-image-roundtrip.XXXXXXXX")
trap 'rm -rf -- "$scratch"' EXIT
declare -A expected
for service in api web; do
  expected[$service]=$(docker image inspect "epmo-$service:ci" | node scripts/ci-image-bundle.mjs identity)
  [[ "$(jq -er .revision <<< "${expected[$service]}")" == "$GITHUB_SHA" ]]
done
docker image save epmo-api:ci epmo-web:ci | gzip -1 > "$scratch/images.tar.gz"
# Remove only this job's private image aliases to exercise a genuine import.
docker image rm epmo-api:ci epmo-web:ci
docker image load --input "$scratch/images.tar.gz"
for service in api web; do
  actual=$(docker image inspect "epmo-$service:ci" | node scripts/ci-image-bundle.mjs identity)
  [[ "$actual" == "${expected[$service]}" ]] || {
    echo "BLOCKED: $service ID, revision or runtime identity changed during Docker save/load" >&2; exit 1;
  }
  echo "PASS: $service image ID, revision and runtime identity survive archive round trip"
done
