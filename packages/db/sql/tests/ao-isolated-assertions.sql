\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database()<>'ao_ci_isolated'
 OR (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname='ao_ci_app')
 OR has_table_privilege('ao_ci_app','public.ao_task_reservations','UPDATE')
 OR has_table_privilege('ao_ci_app','public.ao_task_reservations','DELETE')
 OR NOT has_table_privilege('ao_ci_app','public.ao_task_reservations','SELECT')
 OR NOT has_table_privilege('ao_ci_app','public.ao_task_reservations','INSERT')
 OR (SELECT NOT relrowsecurity OR NOT relforcerowsecurity FROM pg_class WHERE oid='public.ao_task_reservations'::regclass)
 OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.ao_task_reservations'::regclass AND contype='p')<>1
 THEN RAISE EXCEPTION 'AO disposable role/RLS/uniqueness is too weak'; END IF;
END $$;
BEGIN;
SET LOCAL ROLE ao_ci_app;
SELECT set_config('app.tenant_id','',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.ao_task_reservations)<>0
 THEN RAISE EXCEPTION 'AO tenantless read leaked reservations'; END IF;
END $$;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.ao_task_reservations)<>1
 OR EXISTS (SELECT 1 FROM public.ao_task_reservations WHERE tenant_id='22222222-2222-4222-8222-222222222222')
 THEN RAISE EXCEPTION 'AO tenant-1 read violated tenant boundary'; END IF;
END $$;
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  INSERT INTO public.ao_task_reservations
   (tenant_id,request_hash,request_digest,principal_id,tool_id,task_id)
  VALUES('22222222-2222-4222-8222-222222222222',repeat('c',64),repeat('3',64),'principal-a','ao.read','taskid1234567892');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'AO cross-tenant write accepted'; END IF;
END $$;
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  UPDATE public.ao_task_reservations SET state='pending_review'
    WHERE tenant_id='11111111-1111-4111-8111-111111111111';
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'AO restricted role unexpectedly updated rows'; END IF;
END $$;
DO $$ DECLARE n integer; BEGIN
 INSERT INTO public.ao_task_reservations
  (tenant_id,request_hash,request_digest,principal_id,tool_id,task_id)
 VALUES('11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('1',64),'principal-a','ao.read','taskid1234567890')
 ON CONFLICT (tenant_id,request_hash) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'AO duplicate nonce created another reservation'; END IF;
END $$;
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
 INSERT INTO public.ao_task_reservations
  (tenant_id,request_hash,request_digest,principal_id,tool_id,task_id,state)
 VALUES('11111111-1111-4111-8111-111111111111',repeat('d',64),repeat('4',64),'principal-a','ao.read','taskid1234567893','approved');
 EXCEPTION WHEN check_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'AO client forged approved reservation'; END IF;
END $$;
SELECT set_config('app.tenant_id','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.ao_task_reservations)<>1
 OR EXISTS (SELECT 1 FROM public.ao_task_reservations WHERE tenant_id='11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'AO tenant-2 read violated isolation'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: AO disposable tenant RLS/role/idempotency' AS result;
