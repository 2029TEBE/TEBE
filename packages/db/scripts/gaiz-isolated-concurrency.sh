#!/usr/bin/env bash
# Run only AFTER gaiz-isolated-smoke.sh on the same fresh disposable database.
set -euo pipefail
if [[ "${GAIZ_TEST_DB_ACK:-}" != "DISPOSABLE_DB_ONLY" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGDATABASE:-}" != "gaiz_ci_isolated" || -z "${PGUSER:-}" ]]; then
  echo "Refusing concurrency test outside disposable localhost PostgreSQL" >&2
  exit 2
fi
psql_run=(psql -X -w -v ON_ERROR_STOP=1 -h 127.0.0.1 -d gaiz_ci_isolated -U "$PGUSER")
holder="$(mktemp)"
contender="$(mktemp)"
trap 'rm -f "$holder" "$contender"' EXIT

# Hold the project row locked in transaction A, while transaction B attempts
# a stale compare-and-swap under a short lock timeout.
(
 PGAPPNAME=gaiz_test_row_holder "${psql_run[@]}" >"$holder" 2>&1 <<'SQL'
BEGIN;
UPDATE public.projects SET name='Committed by session A'
 WHERE id='33333333-3333-4333-8333-333333333333' AND revision=0;
SELECT pg_sleep(3);
COMMIT;
SQL
) &
holder_pid=$!
ready=false
for _ in $(seq 1 40); do
 count=$("${psql_run[@]}" -Atqc "SELECT count(*) FROM pg_stat_activity WHERE application_name='gaiz_test_row_holder' AND state='active' AND query LIKE '%pg_sleep%'")
 if [[ "$count" == "1" ]]; then ready=true; break; fi
 sleep 0.05
done
if [[ "$ready" != true ]]; then
 wait "$holder_pid" || true
 echo "Could not observe active holder transaction" >&2; exit 1
fi

if "${psql_run[@]}" >"$contender" 2>&1 <<'SQL'
BEGIN;
SET LOCAL lock_timeout='250ms';
UPDATE public.projects SET name='Incorrect stale update'
 WHERE id='33333333-3333-4333-8333-333333333333' AND revision=0;
COMMIT;
SQL
then
  wait "$holder_pid" || true
  echo "Concurrent stale update incorrectly succeeded" >&2; exit 1
fi
if ! grep -q 'lock timeout' "$contender"; then
  cat "$contender" >&2
  wait "$holder_pid" || true
  echo "Contender failed for unexpected reason" >&2; exit 1
fi
wait "$holder_pid"
"${psql_run[@]}" <<'SQL'
DO $$ DECLARE n integer; BEGIN
 IF (SELECT revision FROM public.projects
      WHERE id='33333333-3333-4333-8333-333333333333')<>1 THEN
   RAISE EXCEPTION 'revision was not committed after row lock';
 END IF;
 UPDATE public.projects SET name='Stale CAS must not apply'
  WHERE id='33333333-3333-4333-8333-333333333333' AND revision=0;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'stale compare-and-swap changed a project'; END IF;
END $$;
SQL
echo "GAIZ isolated two-session lock / stale-revision rejection passed."
