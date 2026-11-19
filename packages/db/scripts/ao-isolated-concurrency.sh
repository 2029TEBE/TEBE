#!/usr/bin/env bash
set -euo pipefail
if [[ "${AO_TEST_DB_ACK:-}" != "DISPOSABLE_DB_ONLY" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGPORT:-}" != "5433" ||
      "${PGDATABASE:-}" != "ao_ci_isolated" ||
      "${PGUSER:-}" != "postgres" ]]; then
 echo "Refusing AO concurrency test outside disposable localhost database" >&2
 exit 2
fi
psql_run=(psql -X -w -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5433 -d ao_ci_isolated -U postgres)
holder="$(mktemp)"; contender="$(mktemp)"
trap 'rm -f "$holder" "$contender"' EXIT
(
 PGAPPNAME=ao_ci_holder "${psql_run[@]}" >"$holder" 2>&1 <<'SQL'
BEGIN;
SET LOCAL ROLE ao_ci_app;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
INSERT INTO public.ao_task_reservations
 (tenant_id,request_hash,request_digest,principal_id,tool_id,task_id)
VALUES ('11111111-1111-4111-8111-111111111111',repeat('e',64),repeat('5',64),'principal-a','ao.read','taskid1234567894');
SELECT pg_sleep(3);
COMMIT;
SQL
) &
holder_pid=$!
ready=false
for _ in $(seq 1 60); do
 count=$("${psql_run[@]}" -Atqc "SELECT count(*) FROM pg_stat_activity WHERE application_name='ao_ci_holder' AND state='active' AND query LIKE '%pg_sleep%'")
 if [[ "$count" == "1" ]]; then ready=true; break; fi
 sleep 0.05
done
if [[ "$ready" != true ]]; then
 wait "$holder_pid" || true
 echo "AO concurrent holder not observed" >&2; exit 1
fi
if "${psql_run[@]}" >"$contender" 2>&1 <<'SQL'
BEGIN;
SET LOCAL ROLE ao_ci_app;
SET LOCAL lock_timeout='250ms';
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
INSERT INTO public.ao_task_reservations
 (tenant_id,request_hash,request_digest,principal_id,tool_id,task_id)
VALUES ('11111111-1111-4111-8111-111111111111',repeat('e',64),repeat('5',64),'principal-a','ao.read','taskid1234567894')
ON CONFLICT (tenant_id,request_hash) DO NOTHING;
COMMIT;
SQL
then
 wait "$holder_pid" || true
 echo "Concurrent same-nonce AO reservation did not wait for unique key" >&2; exit 1
fi
if ! grep -q 'lock timeout' "$contender"; then
 cat "$contender" >&2
 wait "$holder_pid" || true
 echo "AO replay contender failed for an unexpected reason" >&2; exit 1
fi
wait "$holder_pid"
"${psql_run[@]}" <<'SQL'
BEGIN;
SET LOCAL ROLE ao_ci_app;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$ DECLARE affected integer; BEGIN
 IF (SELECT count(*) FROM public.ao_task_reservations WHERE request_hash=repeat('e',64))<>1
 THEN RAISE EXCEPTION 'AO duplicate nonce created a second reservation'; END IF;
 INSERT INTO public.ao_task_reservations
  (tenant_id,request_hash,request_digest,principal_id,tool_id,task_id)
 VALUES ('11111111-1111-4111-8111-111111111111',repeat('e',64),repeat('5',64),'principal-a','ao.read','taskid1234567894')
 ON CONFLICT (tenant_id,request_hash) DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'AO post-commit replay was not idempotent'; END IF;
END $$;
SELECT set_config('app.tenant_id','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.ao_task_reservations WHERE request_hash=repeat('e',64))
 THEN RAISE EXCEPTION 'AO tenant-2 read tenant-1 concurrent reservation'; END IF;
END $$;
ROLLBACK;
SQL
echo "PASS: AO two-session unique nonce serialization and cross-tenant read denial"
