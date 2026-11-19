#!/usr/bin/env bash
# Explicitly disposable PostgreSQL 16 fixture. NEVER invoke against production.
set -euo pipefail
if [[ "${AO_TEST_DB_ACK:-}" != "DISPOSABLE_DB_ONLY" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGPORT:-}" != "5433" ||
      "${PGDATABASE:-}" != "ao_ci_isolated" ||
      "${PGUSER:-}" != "postgres" ]]; then
  echo "Refusing AO DB test outside acknowledged disposable localhost PostgreSQL" >&2
  exit 2
fi
command -v psql >/dev/null || { echo "PostgreSQL 16 client required" >&2; exit 2; }
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
psql_run=(psql -X -w -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5433 -d ao_ci_isolated -U postgres)
"${psql_run[@]}" -Atqc "SELECT CASE WHEN current_database()='ao_ci_isolated' AND NOT pg_is_in_recovery() THEN 'SAFE' ELSE 'DENY' END" | grep -qx SAFE
"${psql_run[@]}" -f "$here/sql/tests/ao-isolated-bootstrap.sql"
"${psql_run[@]}" -f "$here/sql/tests/ao-isolated-assertions.sql"
bash "$here/scripts/ao-isolated-concurrency.sh"
echo "PASS: disposable PostgreSQL AO tenant RLS, nonce uniqueness and concurrent replay denial"
echo "This validates a test fixture only. NO production AO schema, runtime route or execution grant."
