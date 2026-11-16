#!/usr/bin/env bash
# GAIZ challenge acceptance on an explicitly disposable CI PostgreSQL only.
# No production database name, service credentials or host are allowed.
set -euo pipefail

[[ "${PHASE15_ACCEPT_DISPOSABLE_DB:-}" == "YES_RESEED_DISPOSABLE_TEST_DATABASE" ]] || {
  echo "BLOCKED: explicit disposable database acknowledgement required" >&2
  exit 1
}
[[ "${PGHOST:-}" == "localhost" || "${PGHOST:-}" == "127.0.0.1" ]] || {
  echo "BLOCKED: PostgreSQL must be loopback" >&2
  exit 1
}
[[ "${PGPORT:-}" == "5433" && "${PGUSER:-}" == "postgres" && "${PGDATABASE:-}" == "postgres" ]] || {
  echo "BLOCKED: only disposable CI postgres admin on port 5433 is supported" >&2
  exit 1
}
command -v psql >/dev/null || { echo "BLOCKED: psql unavailable" >&2; exit 1; }
db=gaiz_challenge_acceptance
cleanup() {
  psql -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS ${db} WITH (FORCE)" >/dev/null
}
# Hard fail when another parallel test has left the named DB present.
if [[ "$(psql -v ON_ERROR_STOP=1 -d postgres -Atc "SELECT COUNT(*) FROM pg_database WHERE datname='${db}'")" != "0" ]]; then
  echo "BLOCKED: acceptance database already exists; refusing to reuse" >&2
  exit 1
fi
psql -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE ${db}" >/dev/null
trap cleanup EXIT
psql -v ON_ERROR_STOP=1 -d "${db}" \
  -f packages/db/sql/gaiz-workload-challenge-disposable-acceptance.sql
