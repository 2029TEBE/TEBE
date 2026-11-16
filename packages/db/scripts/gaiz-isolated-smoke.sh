#!/usr/bin/env bash
# Development-only destructive fixture setup. NEVER run against production.
set -euo pipefail
if [[ "${GAIZ_TEST_DB_ACK:-}" != "DISPOSABLE_DB_ONLY" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGDATABASE:-}" != "gaiz_ci_isolated" ||
      -z "${PGUSER:-}" ]]; then
  echo "Refusing to run: set GAIZ_TEST_DB_ACK=DISPOSABLE_DB_ONLY, PGHOST=127.0.0.1, PGDATABASE=gaiz_ci_isolated, PGUSER=<isolated superuser>" >&2
  exit 2
fi
if ! command -v psql >/dev/null; then
  echo "PostgreSQL psql is required; no test has been run." >&2
  exit 2
fi
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
psql_run=(psql -X -w -v ON_ERROR_STOP=1 -h 127.0.0.1 -d gaiz_ci_isolated -U "$PGUSER")
"${psql_run[@]}" -Atqc "SELECT CASE WHEN current_database()='gaiz_ci_isolated' AND NOT pg_is_in_recovery() THEN 'SAFE' ELSE 'DENY' END" | grep -qx SAFE
"${psql_run[@]}" -f "$here/sql/tests/gaiz-isolated-bootstrap.sql"
for n in 0020_gaiz_import_staging 0021_gaiz_custody_attempts 0022_gaiz_import_authorizations 0023_gaiz_entity_revisions; do
  "${psql_run[@]}" -f "$here/migrations/$n.sql"
done
# Apply GAIZ restrictions from the actual production RLS policy source,
# rather than a hand-copied replica. Other RLS rules require full product schema.
"${psql_run[@]}" -c "GRANT SELECT, INSERT, UPDATE, DELETE ON public.gaiz_import_requests,public.gaiz_custody_attempts,public.gaiz_import_authorizations TO pmo_app"
awk '/^-- GAIZ staged requests/{show=1} /^-- The audit ledger/{show=0} show {print}' "$here/sql/rls.sql" | "${psql_run[@]}"
"${psql_run[@]}" -f "$here/sql/tests/gaiz-isolated-assertions.sql"
echo "GAIZ disposable PostgreSQL schema, RLS and revision smoke assertions completed."
echo "NOTE: this is not a substitute for full TEBE typecheck, customer-key security, or production rollout QA."
