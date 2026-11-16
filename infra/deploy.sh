#!/usr/bin/env bash
# Verified deploy transport for The EPMO. No default server, trust bypass,
# SSH key path, or embedded customer credentials.
#
# Usage:
#   EPMO_DEPLOY_HOST=deploy@staging.example.com infra/deploy.sh staging
#   EPMO_DEPLOY_HOST=deploy@production.example.com infra/deploy.sh prod
# Optional: EPMO_DEPLOY_SSH_KEY=/path/to/key, EPMO_DEPLOY_DIR=/opt/the-epmo
# EPMO_DEPLOY_SSH_KNOWN_HOSTS selects a separate pinned host-key file.
# Servers must already have a pinned/trusted SSH host key in known_hosts.
set -euo pipefail

MODE=${1:-}
case "$MODE" in
  prod)    DIR=/opt/the-epmo;       PROJECT=pmo-prod;      ENVFILE=.env.prod ;;
  staging) DIR=/opt/the-epmo-staging; PROJECT=pmo-staging; ENVFILE=.env.staging ;;
  dev)     DIR=/opt/the-epmo-dev;   PROJECT=align360-dev;  ENVFILE=.env.dev ;;
  *) echo 'Usage: infra/deploy.sh <staging|dev|prod>' >&2; exit 2 ;;
esac

# An optional registry image pair supports promotion without rebuilding.
# Supply the same two digests that passed staging smoke tests.
API_IMAGE=${EPMO_RELEASE_API_IMAGE:-}
WEB_IMAGE=${EPMO_RELEASE_WEB_IMAGE:-}
TESTED_BUNDLE=${EPMO_TESTED_IMAGE_DIR:-}
TESTED_JSON=
if [[ -n "$TESTED_BUNDLE" ]]; then
  [[ "$MODE" == prod && -z "$API_IMAGE" && -z "$WEB_IMAGE" &&
     "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == workflow_run &&
     "${EPMO_CI_VERIFIED_SHA:-}" =~ ^[a-f0-9]{40}$ &&
     "${EPMO_CI_WORKFLOW_RUN_ID:-}" =~ ^[1-9][0-9]*$ ]] || {
    echo 'BLOCKED: tested image bundle requires exact CI-bound production deployment' >&2; exit 1;
  }
  TESTED_JSON=$(node scripts/ci-image-bundle.mjs verify "$TESTED_BUNDLE" "$EPMO_CI_VERIFIED_SHA" "$EPMO_CI_WORKFLOW_RUN_ID" "$GITHUB_REPOSITORY")
  command -v jq >/dev/null
  API_IMAGE=$(jq -er .apiTag <<< "$TESTED_JSON")
  WEB_IMAGE=$(jq -er .webTag <<< "$TESTED_JSON")
  API_RUNTIME_DIGEST=$(jq -er .apiRuntimeDigest <<< "$TESTED_JSON")
  WEB_RUNTIME_DIGEST=$(jq -er .webRuntimeDigest <<< "$TESTED_JSON")
fi
if [[ -z "$TESTED_BUNDLE" && ( -n "$API_IMAGE" || -n "$WEB_IMAGE" ) ]]; then
  IMAGE_REF='^[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$'
  if [[ "$MODE" == dev || ! "$API_IMAGE" =~ $IMAGE_REF || ! "$WEB_IMAGE" =~ $IMAGE_REF ]]; then
    echo 'BLOCKED: staging and prod require both registry image references pinned by SHA-256.' >&2
    exit 2
  fi
fi

# Explicit host prevents accidentally deploying a new product to a legacy IP.
HOST=${EPMO_DEPLOY_HOST:-}
if [[ -z "$HOST" || ! "$HOST" =~ ^[a-zA-Z0-9_.@-]+$ ]]; then
  echo 'BLOCKED: set EPMO_DEPLOY_HOST to a trusted user@hostname (no default).' >&2
  exit 2
fi
# Never let a staging/dev command point at a production checkout (or /).
# --delete in deploy.sh makes an incorrect directory particularly dangerous.
# Custom directories may use a different absolute parent but must retain the
# environment-specific last component. Reject dot components, // and trailing /.
case "$MODE" in
  staging) EXPECTED_DIRNAME=the-epmo-staging ;;
  prod) EXPECTED_DIRNAME=the-epmo ;;
  dev) EXPECTED_DIRNAME=the-epmo-dev ;;
esac
DIR=${EPMO_DEPLOY_DIR:-$DIR}
if [[ ! "$DIR" =~ ^/([a-zA-Z0-9_-]+/)*${EXPECTED_DIRNAME}$ ]]; then
  echo "BLOCKED: EPMO_DEPLOY_DIR must be an absolute directory ending in /${EXPECTED_DIRNAME} (mode: $MODE)." >&2
  exit 2
fi

SSH_CMD=(ssh -o BatchMode=yes -o StrictHostKeyChecking=yes)
if [[ -n "${EPMO_DEPLOY_SSH_KEY:-}" ]]; then
  [[ -f "$EPMO_DEPLOY_SSH_KEY" ]] || { echo 'BLOCKED: SSH identity file does not exist.' >&2; exit 2; }
  SSH_CMD+=(-i "$EPMO_DEPLOY_SSH_KEY")
fi
if [[ -n "${EPMO_DEPLOY_SSH_KNOWN_HOSTS:-}" ]]; then
  [[ -s "$EPMO_DEPLOY_SSH_KNOWN_HOSTS" ]] || { echo 'BLOCKED: pinned known-hosts file missing or empty.' >&2; exit 2; }
  SSH_CMD+=(-o "UserKnownHostsFile=$EPMO_DEPLOY_SSH_KNOWN_HOSTS" -o GlobalKnownHostsFile=/dev/null -o IdentitiesOnly=yes)
fi
# rsync -e accepts a command string. Quote each argument to preserve paths.
printf -v SSH_FOR_RSYNC '%q ' "${SSH_CMD[@]}"
ssh_remote() { "${SSH_CMD[@]}" "$HOST" "$1"; }

# The production deploy must be verified locally before files are copied.
if [[ "$MODE" == prod ]]; then
  # GitHub workflow_run provides a successful full CI run for the exact SHA.
  # When this attestation is present, avoid running database-dependent tests
  # a second time on a runner without its CI PostgreSQL service. Never accept
  # an unbound skip flag or a different checkout revision.
  if [[ -n "${EPMO_CI_VERIFIED_SHA:-}" || -n "${EPMO_CI_WORKFLOW_RUN_ID:-}" ]]; then
    [[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == workflow_run &&
       "${EPMO_CI_VERIFIED_SHA:-}" =~ ^[0-9a-f]{40}$ &&
       "${EPMO_CI_WORKFLOW_RUN_ID:-}" =~ ^[1-9][0-9]*$ ]] || {
      echo 'BLOCKED: incomplete production CI attestation.' >&2; exit 1;
    }
    command -v git >/dev/null || { echo 'BLOCKED: git is required to verify the tested SHA.' >&2; exit 1; }
    [[ "$(git rev-parse HEAD)" == "$EPMO_CI_VERIFIED_SHA" ]] || {
      echo 'BLOCKED: checked-out revision does not match the successful CI run.' >&2; exit 1;
    }
    echo "Using successfully completed CI run $EPMO_CI_WORKFLOW_RUN_ID for revision $EPMO_CI_VERIFIED_SHA."
  else
    command -v pnpm >/dev/null || { echo 'BLOCKED: pnpm is required for production verification.' >&2; exit 1; }
    pnpm -s verify
  fi
fi

# Fail before rsync --delete if the remote environment has not been prepared.
# Environment files are owned by the server and excluded from rsync, so they
# must already exist. This check also validates SSH trust/connectivity before
# writing to the destination; the complete RC1 preflight runs after sync.
# A symlink in any path component could redirect --delete into a different tree.
# Require realpath to resolve to the exact requested absolute directory.
if ! ssh_remote "test -d '$DIR' && test \"\$(realpath -e '$DIR')\" = '$DIR' && test -r '$DIR/$ENVFILE' && command -v docker >/dev/null && command -v node >/dev/null"; then
  echo "BLOCKED: remote $MODE destination, $ENVFILE, Docker, or Node.js is not ready. No files copied." >&2
  exit 1
fi

echo "Deploying $MODE to $HOST:$DIR"
# rsync --delete can remove old, untracked configuration backups and artifacts.
# Protect *replaced or deleted* files in a root outside the deployment tree.
# The remote account owns the snapshot, stored with restrictive permissions.
remote_home=$(ssh_remote 'printf "%s" "$HOME"')
if [[ ! "$remote_home" =~ ^/([a-zA-Z0-9_.-]+/)*[a-zA-Z0-9_.-]+$ ]]; then
  echo 'BLOCKED: cannot establish a safe remote backup root' >&2
  exit 1
fi
snapshot_stamp=$(date -u +%Y%m%dT%H%M%SZ)
snapshot_dir="$remote_home/the-epmo-deployment-snapshots/$MODE/$snapshot_stamp"
if [[ "$snapshot_dir" == "$DIR" || "$snapshot_dir" == "$DIR/"* ]]; then
  echo 'BLOCKED: snapshot path would be inside the deployment tree' >&2
  exit 1
fi
ssh_remote "umask 077; mkdir -p '$snapshot_dir' && chmod 700 '$snapshot_dir'"
# Secrets are server-managed. Never copy *.env or .git to a destination.
# --backup saves overwritten/deleted pre-existing remote files outside --delete.
rsync -az --delete --backup --backup-dir="$snapshot_dir" --no-owner --no-group \
  --exclude node_modules --exclude .next --exclude .next-prod --exclude dist \
  --exclude '.env' --exclude '.env.*' --exclude .git --exclude .DS_Store \
  --exclude .deployed-revision \
  -e "$SSH_FOR_RSYNC" ./ "$HOST:$DIR/"
echo "Protected overwritten/deleted destination files under $HOST:$snapshot_dir"

COMPOSE="docker compose -f docker-compose.prod.yml -p $PROJECT --env-file $ENVFILE"
if [[ "$MODE" == dev ]]; then
  COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.dev-server.yml -p $PROJECT --env-file $ENVFILE"
else
  # Must fail before any migration or container start if remote credentials,
  # Stripe deployment mode, or domain configuration are unsafe.
  ssh_remote "cd '$DIR' && node scripts/rc1-release-gate.mjs --mode '$([[ $MODE == prod ]] && echo production || echo staging)' --env-file '$ENVFILE'"
fi

# Build BEFORE changing the database. A failed image build must leave the
# currently running application and schema untouched.
if [[ -n "$TESTED_BUNDLE" ]]; then
  # Docker load accepts the authenticated gzip archive over SSH stdin. No
  # registry credentials, remote archive extraction or VPS rebuild is needed.
  # Reclaim unused build cache before expanding the archive. Keep all images,
  # containers, volumes and database backups for service continuity and rollback.
  ssh_remote "docker builder prune --all --force && docker system df"
  ssh_remote "docker image load" < "$TESTED_BUNDLE/images.tar.gz"
  # Docker image IDs are the SHA-256 of the image configuration, including
  # rootfs layer DiffIDs. Unlike inspect's serialized runtime fields, the ID is
  # content-addressed and stable across Docker daemon versions and save/load.
  # The manifest and archive were already verified against exact successful CI.
  API_EXPECTED_ID=$(jq -er .apiId <<< "$TESTED_JSON")
  WEB_EXPECTED_ID=$(jq -er .webId <<< "$TESTED_JSON")
  for spec in "api|$API_EXPECTED_ID|$API_IMAGE" "web|$WEB_EXPECTED_ID|$WEB_IMAGE"; do
    IFS='|' read -r service expected_id release_tag <<< "$spec"
    loaded=$(ssh_remote "docker image inspect 'epmo-$service:ci'")
    identity=$(printf '%s' "$loaded" | node scripts/ci-image-bundle.mjs identity)
    actual=$(jq -er .id <<< "$identity")
    revision=$(jq -er .revision <<< "$identity")
    [[ "$actual" == "$expected_id" && "$revision" == "$EPMO_CI_VERIFIED_SHA" ]] || {
      echo "BLOCKED: $service loaded image content ID or revision differs from attested CI" >&2; exit 1;
    }
    ssh_remote "docker image tag '$actual' '$release_tag'"
    if [[ "$service" == api ]]; then API_IMAGE_ID=$actual; else WEB_IMAGE_ID=$actual; fi
  done
  APP_COMPOSE="EPMO_RELEASE_API_IMAGE='$API_IMAGE' EPMO_RELEASE_WEB_IMAGE='$WEB_IMAGE' $COMPOSE -f docker-compose.tested-images.yml"
elif [[ -n "$API_IMAGE" ]]; then
  APP_COMPOSE="EPMO_RELEASE_API_IMAGE='$API_IMAGE' EPMO_RELEASE_WEB_IMAGE='$WEB_IMAGE' $COMPOSE -f docker-compose.release-images.yml"
  ssh_remote "cd '$DIR' && $APP_COMPOSE pull api web"
else
  APP_COMPOSE="$COMPOSE"
  ssh_remote "cd '$DIR' && $COMPOSE build api web"
fi
# Bring up dependencies for the backup and migration; do not start new API/web
# containers until both operations succeed.
ssh_remote "cd '$DIR' && $COMPOSE up -d postgres redis"
if [[ "$MODE" == staging || "$MODE" == prod ]]; then
  # Fail closed: no verified pre-migration dump, no schema upgrade.
  # Backups live OUTSIDE the rsync --delete deployment path.
  if ! backup_result=$(ssh_remote "cd '$DIR' && bash infra/backup-db.sh '$MODE'"); then
    echo 'BLOCKED: mandatory pre-migration backup failed' >&2
    exit 1
  fi
  printf '%s\n' "$backup_result"
  if [[ "$MODE" == staging ]]; then
    # Prove backup restoration on an isolated staging database before changing
    # the real schema. Accept only the path emitted by the successful backup.
    backup_path=$(printf '%s\n' "$backup_result" | sed -n 's/^PASS: verified pre-migration PostgreSQL backup: //p')
    if [[ ! "$backup_path" =~ ^/[a-zA-Z0-9_./-]+$ || "$backup_path" != */epmo-staging-*.dump ]]; then
      echo 'BLOCKED: backup command did not return a safe staging archive path' >&2
      exit 1
    fi
    ssh_remote "cd '$DIR' && bash infra/rehearse-db-restore.sh staging '$backup_path'"
  fi
fi
ssh_remote "cd '$DIR' && bash infra/bootstrap-db.sh '$MODE'"
if [[ -n "$API_IMAGE" ]]; then
  ssh_remote "cd '$DIR' && $APP_COMPOSE up -d --no-build --pull never api web"
else
  ssh_remote "cd '$DIR' && $COMPOSE up -d api web"
fi

# Health must hold for BOTH services before recording this release.
ssh_remote "cd '$DIR' && \
  ready=0; \
  for attempt in \$(seq 1 60); do \
    ready=1; \
    for service in api web; do \
      container=\$($COMPOSE ps -q \"\$service\"); \
      status=\$(docker inspect -f '{{.State.Health.Status}}' \"\$container\" 2>/dev/null || true); \
      if [ \"\$status\" = unhealthy ]; then ready=-1; break; fi; \
      if [ \"\$status\" != healthy ]; then ready=0; fi; \
    done; \
    if [ \"\$ready\" -eq 1 ] || [ \"\$ready\" -eq -1 ]; then break; fi; \
    sleep 3; \
  done; \
  if [ \"\$ready\" -ne 1 ]; then \
    echo 'BLOCKED: API/web did not both become healthy within the deployment window' >&2; \
    $COMPOSE ps >&2; \
    $COMPOSE logs --tail 50 web api >&2; \
    exit 1; \
  fi"
# A healthy container alone does not prove that Arabic/English sign-in works
# or that anonymous users cannot access protected pages. Only check staging
# on the localhost port mapped to THIS Compose web container, never a public
# URL or a pre-existing unrelated process. A failed check blocks deploy success.
if [[ "$MODE" == staging ]]; then
  ssh_remote "cd '$DIR' && container=\$($COMPOSE ps -q web); \
    test -n \"\$container\" && node scripts/phase16c-verify-staging-web.mjs --env-file '$ENVFILE' --container \"\$container\""
fi
# Also attest that the ACTUAL healthy staging API container is using production
# authentication settings, and that billing/platform endpoints reject anonymous
# requests and forged tenant headers. Run probes inside the private container,
# never expose its API port on the host.
if [[ "$MODE" == staging ]]; then
  ssh_remote "cd '$DIR' && container=\$($COMPOSE ps -q api); \
    test -n \"\$container\" && node scripts/phase16d-verify-staging-api.mjs --env-file '$ENVFILE' --container \"\$container\""
fi
echo "PASS: $MODE API and web containers healthy on $HOST"

if [[ -n "$TESTED_BUNDLE" ]]; then
  for spec in "api|$API_IMAGE_ID" "web|$WEB_IMAGE_ID"; do
    IFS='|' read -r service expected_id <<< "$spec"
    actual=$(ssh_remote "cd '$DIR' && container=\$($COMPOSE ps -q '$service'); test -n \"\$container\" && docker inspect --format '{{.Image}}' \"\$container\"")
    [[ "$actual" == "$expected_id" ]] || { echo 'BLOCKED: running image does not match tested content' >&2; exit 1; }
  done
fi
