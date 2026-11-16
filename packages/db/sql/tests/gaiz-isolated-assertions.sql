\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database()<>'gaiz_ci_isolated' THEN RAISE EXCEPTION 'non-isolated DB'; END IF;
 IF has_table_privilege('pmo_app','public.gaiz_import_requests','DELETE')
 OR has_table_privilege('pmo_app','public.gaiz_custody_attempts','DELETE')
 OR has_table_privilege('pmo_app','public.gaiz_import_authorizations','DELETE')
 OR has_column_privilege('pmo_app','public.gaiz_import_requests','sha256','UPDATE')
 OR has_column_privilege('pmo_app','public.gaiz_import_authorizations','preview_sha256','UPDATE')
 OR has_column_privilege('pmo_app','public.gaiz_import_requests','status','INSERT')
 OR has_column_privilege('pmo_app','public.gaiz_custody_attempts','status','INSERT')
 OR has_column_privilege('pmo_app','public.gaiz_import_authorizations','status','INSERT')
 OR has_column_privilege('pmo_app','public.gaiz_mapping_profiles','status','INSERT')
 OR has_column_privilege('pmo_app','public.gaiz_mapping_profiles','field_mappings','UPDATE')
 THEN RAISE EXCEPTION 'GAIZ effective DB privileges are too broad'; END IF;
END $$;
-- Synthetic tenant-2 row is seeded by isolated DB superuser to test RLS reads.
INSERT INTO public.gaiz_import_requests(tenant_id,artifact_id,sha256,issuer_id,requested_by)
 VALUES('22222222-2222-4222-8222-222222222222','tenant-two-public-test',repeat('f',64),'synthetic-issuer',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
BEGIN;
SET LOCAL ROLE pmo_app;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.gaiz_import_requests WHERE tenant_id='22222222-2222-4222-8222-222222222222')<>0
 THEN RAISE EXCEPTION 'tenant-2 records leaked to tenant-1'; END IF;
END $$;
SELECT set_config('app.tenant_id','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.gaiz_import_requests WHERE tenant_id='22222222-2222-4222-8222-222222222222')<>1
 THEN RAISE EXCEPTION 'tenant-2 authorized read failed'; END IF;
END $$;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  INSERT INTO public.gaiz_import_requests
   (tenant_id,artifact_id,sha256,issuer_id,requested_by,status,reviewed_by,reviewed_at)
  VALUES ('11111111-1111-4111-8111-111111111111','forged-approval',repeat('e',64),'synthetic-issuer',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now());
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'forged preapproved stage INSERT accepted'; END IF;
END $$;
INSERT INTO public.gaiz_import_requests
 (id,tenant_id,artifact_id,sha256,issuer_id,requested_by)
VALUES
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','synthetic-a',repeat('a',64),'synthetic-issuer','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','synthetic-b',repeat('b',64),'synthetic-issuer','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  UPDATE public.gaiz_import_requests SET status='approved',
   reviewed_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reviewed_at=now()
   WHERE id='55555555-5555-4555-8555-555555555555';
 EXCEPTION WHEN check_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'self-review accepted'; END IF;
END $$;
UPDATE public.gaiz_import_requests SET status='approved',
 reviewed_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',reviewed_at=now()
 WHERE id='55555555-5555-4555-8555-555555555555';
INSERT INTO public.gaiz_custody_attempts
 (id,tenant_id,review_id,artifact_sha256,recipient_key_id,requested_by)
VALUES
 ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',repeat('a',64),'synthetic-recipient','cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666',repeat('b',64),'synthetic-recipient','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
-- The authorization must reference the exact tenant/kind profile.
INSERT INTO public.gaiz_mapping_profiles
 (tenant_id,profile_id,target_kind,field_mappings,requested_by)
 VALUES('11111111-1111-4111-8111-111111111111','binding-profile',
 'project','["project.name"]'::jsonb,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
UPDATE public.gaiz_mapping_profiles SET status='approved',
 reviewed_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',reviewed_at=now()
 WHERE profile_id='binding-profile';
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  INSERT INTO public.gaiz_import_authorizations
   (tenant_id,staging_review_id,custody_attempt_id,target_kind,target_id,target_snapshot_sha256,preview_sha256,mapping_profile_id,requested_by)
  VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','88888888-8888-4888-8888-888888888888','project','33333333-3333-4333-8333-333333333333',repeat('c',64),repeat('d',64),'binding-profile','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 EXCEPTION WHEN foreign_key_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'wrong custody/stage pairing accepted'; END IF;
END $$;
INSERT INTO public.gaiz_import_authorizations
 (tenant_id,staging_review_id,custody_attempt_id,target_kind,target_id,target_snapshot_sha256,preview_sha256,mapping_profile_id,requested_by)
VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','77777777-7777-4777-8777-777777777777','project','33333333-3333-4333-8333-333333333333',repeat('c',64),repeat('d',64),'binding-profile','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  INSERT INTO public.gaiz_import_authorizations
   (tenant_id,staging_review_id,custody_attempt_id,target_kind,target_id,target_snapshot_sha256,preview_sha256,mapping_profile_id,requested_by)
  VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','77777777-7777-4777-8777-777777777777','project','33333333-3333-4333-8333-333333333333',repeat('c',64),repeat('d',64),'binding-profile','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 EXCEPTION WHEN unique_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'duplicate authorization accepted'; END IF;
END $$;
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  INSERT INTO public.gaiz_import_requests(tenant_id,artifact_id,sha256,issuer_id,requested_by)
  VALUES ('22222222-2222-4222-8222-222222222222','cross-tenant',repeat('e',64),'synthetic-issuer','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'cross-tenant INSERT accepted'; END IF;
END $$;
-- Two-person registry approvals never elevate into import permission.
INSERT INTO public.gaiz_mapping_profiles
 (tenant_id,profile_id,target_kind,field_mappings,requested_by)
 VALUES ('11111111-1111-4111-8111-111111111111','synthetic-project-v1',
 'project','["project.name"]'::jsonb,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  UPDATE public.gaiz_mapping_profiles SET status='approved',
   reviewed_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reviewed_at=now()
   WHERE profile_id='synthetic-project-v1';
 EXCEPTION WHEN check_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'mapping registry self-review accepted'; END IF;
END $$;
UPDATE public.gaiz_mapping_profiles SET status='approved',
 reviewed_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',reviewed_at=now()
 WHERE profile_id='synthetic-project-v1';
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  INSERT INTO public.gaiz_mapping_profiles
  (tenant_id,profile_id,target_kind,field_mappings,requested_by,status)
  VALUES('11111111-1111-4111-8111-111111111111','preapproved-registry',
  'project','["project.name"]'::jsonb,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'forged preapproved mapping accepted'; END IF;
END $$;
ROLLBACK;
-- Original updates must increment revisions; a transaction rollback must restore them.
BEGIN;
UPDATE public.projects SET name='Synthetic revised' WHERE id='33333333-3333-4333-8333-333333333333';
UPDATE public.portfolios SET description='Synthetic revised' WHERE id='44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
 IF (SELECT revision FROM public.projects WHERE id='33333333-3333-4333-8333-333333333333')<>1
 OR (SELECT revision FROM public.portfolios WHERE id='44444444-4444-4444-8444-444444444444')<>1
 THEN RAISE EXCEPTION 'revision update trigger failed'; END IF;
END $$;
ROLLBACK;
DO $$ BEGIN
 IF (SELECT revision FROM public.projects WHERE id='33333333-3333-4333-8333-333333333333')<>0
 OR (SELECT revision FROM public.portfolios WHERE id='44444444-4444-4444-8444-444444444444')<>0
 THEN RAISE EXCEPTION 'revision rollback not atomic'; END IF;
END $$;
SELECT 'GAIZ isolated schema/RLS/constraints smoke checks passed' AS test_result;
