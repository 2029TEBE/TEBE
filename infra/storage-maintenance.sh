#!/usr/bin/env bash
# Run only as the existing production deployment identity. No volumes,
# containers, backups, application files or explicit rollback tags are pruned.
set -euo pipefail
exec 9>"$HOME/.epmo-storage-maintenance.lock"
flock -w 60 9
echo 'Storage before bounded maintenance:'
df -Pk /var/lib/docker /var/lib/containerd
docker system df
# Keep tagged rollback images; only dangling, unused images expire at 24h.
# Build cache is reproducible from CI. Retain one day rather than seven to
# recover deploy headroom without touching images, volumes or rollback tags.
docker builder prune --all --force --filter until=24h
docker image prune --force --filter until=24h
# Managed immutable release aliases expire after seven days. Running images
# remain protected; the fixed previous-release rollback tags retain rollback.
cutoff=$(( $(date +%s) - 7 * 86400 ))
running=$(docker ps -aq | xargs -r docker inspect --format '{{.Image}}')

# Retire only the inventoried pre-release API build, never a moving latest tag.
legacy_tag=pmo-prod-api:latest
legacy_expected=sha256:e31d42bf84f67f0075faae0c9b90b241025c6497f96074f43396992e780d4d3d
if legacy_id=$(docker image inspect --format '{{.Id}}' "$legacy_tag" 2>/dev/null); then
  legacy_tags=$(docker image inspect --format '{{json .RepoTags}}' "$legacy_id")
  active_api=$(docker ps --filter 'name=^/pmo-prod-api-1$' --filter health=healthy --format '{{.Image}}')
  if rollback_api=$(docker image inspect --format '{{.Id}}' epmo-rollback-api:previous 2>/dev/null) &&
     [[ "$legacy_id" == "$legacy_expected" && "$rollback_api" != "$legacy_id" &&
        "$active_api" =~ ^epmo-release-api:[a-f0-9]{40}$ &&
        "$legacy_tags" == '["pmo-prod-api:latest"]' ]] &&
     ! grep -Fxq "$legacy_id" <<< "$running"; then
    docker image rm "$legacy_tag"
  else
    echo 'Legacy API image retained: identity, live release, or rollback checks did not clear.'
  fi
fi

# CI import tags are temporary candidates, not release or rollback aliases.
# The workflow lock excludes deployment; protect every container reference.
for candidate in epmo-api:ci epmo-web:ci; do
  if ! candidate_id=$(docker image inspect --format '{{.Id}}' "$candidate" 2>/dev/null); then continue; fi
  if grep -Fxq "$candidate_id" <<< "$running"; then continue; fi
  # No force: Docker also refuses removal when a container still needs it.
  # Other release/rollback tags retain their image and shared layers.
  docker image rm "$candidate"
done
while IFS='|' read -r repository tag id; do
  [[ "$repository" =~ ^epmo-release-(api|web)$ && "$tag" =~ ^[a-f0-9]{40}$ ]] || continue
  image_id=$(docker image inspect --format '{{.Id}}' "$repository:$tag")
  if grep -Fxq "$image_id" <<< "$running"; then continue; fi
  created=$(docker image inspect --format '{{.Created}}' "$repository:$tag")
  created_epoch=$(date -d "$created" +%s)
  if (( created_epoch < cutoff )); then
    # No --force: Docker refuses a container/image reference conflict.
    docker image rm "$repository:$tag"
  fi
done < <(docker image ls --no-trunc --format '{{.Repository}}|{{.Tag}}|{{.ID}}')
docker system df
echo 'Storage after bounded maintenance:'
df -Pk /var/lib/docker /var/lib/containerd
