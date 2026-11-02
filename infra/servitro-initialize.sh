#!/usr/bin/env bash
# Run as root on a NEW Servitro host after cloning this repository.
# Creates private secrets and an empty, migration-managed database. Never seeds demo data.
set -euo pipefail
cd "$(dirname "$0")/.."
[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }
command -v docker >/dev/null
export DEBIAN_FRONTEND=noninteractive
apt-get install -y nodejs
node scripts/verify-migration-chain.mjs
ENVFILE=.env.prod
if ! grep -q '^# EPMO_SERVITRO_INITIALIZED$' "$ENVFILE" 2>/dev/null; then
  if docker volume inspect pmo-prod_pgdata >/dev/null 2>&1; then
    echo "STOP: existing database volume; preserve and reconcile its credentials first."
    exit 1
  fi
  umask 077
  [ ! -f "$ENVFILE" ] || cp -p "$ENVFILE" "$ENVFILE.before-servitro"
  node --input-type=module <<'NODE'
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const secret=()=>randomBytes(32).toString('hex');
const pg=secret(), app=secret(), redis=secret();
const env=[
'# EPMO_SERVITRO_INITIALIZED',
'PG_USER=pmo_admin','PG_PASSWORD='+pg,'PG_DB=pmo',
'REDIS_PASSWORD='+redis,
'DATABASE_URL=postgres://pmo_app:'+app+'@postgres:5432/pmo',
'REDIS_URL=redis://:'+redis+'@redis:6379',
'WEB_ORIGIN=https://app.theepmo.com',
'PUBLIC_API_URL=https://app.theepmo.com',
'WEB_BIND=127.0.0.1','WEB_PORT=3000',
'DEPLOYMENT_ENV=production',
'STRIPE_ENABLED=false',
'STRIPE_ALLOW_TEST_MODE_IN_PRODUCTION=false',
'BILLING_REFERENCE_WEBHOOK_ENABLED=false',
'MAIL_TRANSPORT=none','MAIL_FROM=',
'MS_TOKEN_KEY='+secret(),
''];
writeFileSync('.env.prod',env.join('\n'),{mode:0o600});
NODE
fi
chmod 600 "$ENVFILE"
# Only validate; never print the rendered Compose configuration (it includes secrets).
docker compose --env-file "$ENVFILE" -f docker-compose.prod.yml config --quiet
docker compose --env-file "$ENVFILE" -f docker-compose.prod.yml up -d postgres redis
bash infra/bootstrap-db.sh prod
echo "SERVITRO_DATABASE_READY: migrations and RLS applied. Payments and email remain disabled."
