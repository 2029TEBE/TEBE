#!/usr/bin/env bash
# Isolated GAIZ2 release-ledger acceptance. No production migrations.
set -euo pipefail
[[ "${PHASE15_ACCEPT_DISPOSABLE_DB:-}" == "YES_RESEED_DISPOSABLE_TEST_DATABASE" ]] || {
  echo "BLOCKED: disposable database acknowledgement required" >&2; exit 1;
}
[[ "${PGHOST:-}" == "localhost" || "${PGHOST:-}" == "127.0.0.1" ]] || {
  echo "BLOCKED: loopback PostgreSQL only" >&2; exit 1;
}
[[ "${PGPORT:-}" == "5433" && "${PGUSER:-}" == "postgres" && "${PGDATABASE:-}" == "postgres" ]] || {
  echo "BLOCKED: CI-only postgres administrator on port 5433 required" >&2; exit 1;
}
command -v psql >/dev/null || { echo "BLOCKED: psql missing" >&2; exit 1; }
db=gaiz2_kms_disposable_acceptance
if [[ "$(psql -v ON_ERROR_STOP=1 -d postgres -Atc "SELECT count(*) FROM pg_database WHERE datname='${db}'")" != "0" ]]; then
  echo "BLOCKED: test database already exists; refusing reuse" >&2; exit 1;
fi
psql -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE ${db}" >/dev/null
cleanup() {
 psql -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS ${db} WITH (FORCE)" >/dev/null
}
trap cleanup EXIT
psql -v ON_ERROR_STOP=1 -d "${db}" -f packages/db/sql/gaiz2-kms-release-disposable-acceptance.sql
