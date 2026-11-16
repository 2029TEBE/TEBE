-- Disposable-only PostgreSQL 16 acceptance, run by guarded CI wrapper.
-- Synthetic data only. NEVER invoke on production, existing schemas or tenants.
\set ON_ERROR_STOP on
CREATE TABLE gaiz2_custody_grant_claims (
 token_sha256 bytea PRIMARY KEY CHECK(octet_length(token_sha256)=32),
 tenant_id uuid NOT NULL,
 worker_id uuid NOT NULL,
 work_item_id uuid NOT NULL,
 assignment_id uuid NOT NULL,
 envelope_sha256 bytea NOT NULL CHECK(octet_length(envelope_sha256)=32),
 recipient_key_id text NOT NULL,
 UNIQUE(token_sha256,tenant_id,worker_id,work_item_id,assignment_id,envelope_sha256,recipient_key_id)
);
\ir gaiz2-recipient-key-registry-REVIEW-ONLY.sql
\ir gaiz2-kms-release-claim-REVIEW-ONLY.sql
INSERT INTO gaiz2_recipient_key_registry (
 tenant_id,recipient_key_id,key_version,kms_key_reference,state,not_before,not_after
) VALUES (
 '11111111-1111-4111-8111-111111111111','key-1','v1',
 'test-only-kms-reference-not-a-key','active',clock_timestamp()-interval '1 hour',
 clock_timestamp()+interval '1 hour'
);
INSERT INTO gaiz2_custody_grant_claims (
 token_sha256,tenant_id,worker_id,work_item_id,assignment_id,envelope_sha256,recipient_key_id
) VALUES (
 decode(repeat('aa',32),'hex'),'11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 '44444444-4444-4444-8444-444444444444',
 decode(repeat('bb',32),'hex'),'key-1'
);
INSERT INTO gaiz2_kms_release_claims (
 tenant_id,custody_token_sha256,assignment_id,worker_id,work_item_id,
 envelope_sha256,recipient_key_id,key_version,kms_operation_id,expires_at
) VALUES (
 '11111111-1111-4111-8111-111111111111',decode(repeat('aa',32),'hex'),
 '44444444-4444-4444-8444-444444444444',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 decode(repeat('bb',32),'hex'),'key-1','v1',
 '55555555-5555-4555-8555-555555555555',clock_timestamp()+interval '15 seconds'
);
DO $test$
DECLARE denied boolean;
BEGIN
 -- Each invalid synthetic request must be blocked by a REAL PostgreSQL constraint.
 denied:=false;
 BEGIN
  INSERT INTO gaiz2_kms_release_claims
   (tenant_id,custody_token_sha256,assignment_id,worker_id,work_item_id,
    envelope_sha256,recipient_key_id,key_version,kms_operation_id,expires_at)
  VALUES
   ('11111111-1111-4111-8111-111111111111',decode(repeat('aa',32),'hex'),
   '44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',decode(repeat('bb',32),'hex'),
   'key-1','v1','66666666-6666-4666-8666-666666666666',clock_timestamp()+interval '15 seconds');
 EXCEPTION WHEN unique_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'duplicate custody token was accepted'; END IF;

 denied:=false;
 BEGIN
  INSERT INTO gaiz2_kms_release_claims
   (tenant_id,custody_token_sha256,assignment_id,worker_id,work_item_id,
    envelope_sha256,recipient_key_id,key_version,kms_operation_id,expires_at)
  VALUES
   ('77777777-7777-4777-8777-777777777777',decode(repeat('aa',32),'hex'),
   '44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',decode(repeat('bb',32),'hex'),
   'key-1','v1','88888888-8888-4888-8888-888888888888',clock_timestamp()+interval '15 seconds');
 EXCEPTION WHEN unique_violation OR foreign_key_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'cross-tenant replay was accepted'; END IF;

 denied:=false;
 BEGIN
  INSERT INTO gaiz2_kms_release_claims
   (tenant_id,custody_token_sha256,assignment_id,worker_id,work_item_id,
    envelope_sha256,recipient_key_id,key_version,kms_operation_id,expires_at)
  VALUES
   ('11111111-1111-4111-8111-111111111111',decode(repeat('cc',32),'hex'),
   '44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',decode(repeat('bb',32),'hex'),
   'key-1','v1','99999999-9999-4999-8999-999999999999',clock_timestamp()+interval '15 seconds');
 EXCEPTION WHEN foreign_key_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'unclaimed grant was accepted'; END IF;

 denied:=false;
 BEGIN
  INSERT INTO gaiz2_kms_release_claims
   (tenant_id,custody_token_sha256,assignment_id,worker_id,work_item_id,
    envelope_sha256,recipient_key_id,key_version,kms_operation_id,expires_at)
  VALUES
   ('11111111-1111-4111-8111-111111111111',decode(repeat('dd',32),'hex'),
   '44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',decode(repeat('bb',32),'hex'),
   'key-1','v999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',clock_timestamp()+interval '15 seconds');
 EXCEPTION WHEN foreign_key_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'unknown key version was accepted'; END IF;

 denied:=false;
 BEGIN
  UPDATE gaiz2_kms_release_claims SET status='consumed'
   WHERE kms_operation_id='55555555-5555-4555-8555-555555555555';
 EXCEPTION WHEN check_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'consumed without timestamp was accepted'; END IF;
 IF (SELECT count(*) FROM gaiz2_kms_release_claims)<>1 THEN
  RAISE EXCEPTION 'invalid requests persisted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE relname LIKE 'gaiz2_%'
       AND relkind='r' AND (NOT relrowsecurity OR NOT relforcerowsecurity)) THEN
  RAISE EXCEPTION 'GAIZ2 table without FORCE RLS'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL
       aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
       WHERE c.relname IN ('gaiz2_kms_release_claims','gaiz2_recipient_key_registry')
       AND a.grantee=0 AND a.privilege_type='SELECT') THEN
  RAISE EXCEPTION 'public GAIZ2 table access'; END IF;
 RAISE NOTICE 'GAIZ2 disposable PostgreSQL release-ledger constraints PASS';
END
$test$;
