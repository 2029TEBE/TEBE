-- GAIZ workload challenge acceptance: DISPOSABLE DATABASES ONLY.
-- This script provisions temporary NOLOGIN roles, applies the REVIEW-ONLY
-- challenge schema, checks real FORCE RLS and atomic replay/rollback, and
-- removes the table/roles after successful tests. NEVER run in production.
-- Requires superuser in an isolated database and pre-existing pmo_app role.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_database() <> 'gaiz_challenge_acceptance' THEN
    RAISE EXCEPTION 'Refusing GAIZ challenge acceptance outside the named disposable DB';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pmo_app') THEN
    RAISE EXCEPTION 'Required pmo_app role absent';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN
    ('gaiz_challenge_issuer','gaiz_verify_worker','gaiz_execute_worker')) THEN
    RAISE EXCEPTION 'Refusing to reuse existing GAIZ worker/issuer roles';
  END IF;
END $$;

CREATE ROLE gaiz_challenge_issuer NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE gaiz_verify_worker NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE gaiz_execute_worker NOLOGIN NOINHERIT NOBYPASSRLS;

\ir gaiz-workload-challenge-review-proposal.sql

DO $$
BEGIN
  IF has_table_privilege('pmo_app','gaiz_workload_challenges','SELECT') OR
     has_table_privilege('pmo_app','gaiz_workload_challenges','INSERT') OR
     has_table_privilege('pmo_app','gaiz_workload_challenges','UPDATE') THEN
    RAISE EXCEPTION 'Interactive app role gained challenge ledger access';
  END IF;
  IF NOT (SELECT relforcerowsecurity AND relrowsecurity FROM pg_class
          WHERE oid='gaiz_workload_challenges'::regclass) THEN
    RAISE EXCEPTION 'Challenge ledger must FORCE RLS';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN
    ('gaiz_challenge_issuer','gaiz_verify_worker','gaiz_execute_worker')
    AND (rolsuper OR rolbypassrls OR rolinherit OR rolcanlogin)) THEN
    RAISE EXCEPTION 'GAIZ test roles are overprivileged';
  END IF;
END $$;

-- An isolated TLS ingress has already authorized this synthetic work item.
BEGIN;
SET LOCAL ROLE gaiz_challenge_issuer;
INSERT INTO gaiz_workload_challenges
(challenge_sha256,tenant_id,worker_id,work_item_id,purpose,credential_issuer,expires_at)
VALUES
(decode(repeat('ab',32),'hex'),
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222',
 'gaiz_verify_worker','synthetic-issuer',clock_timestamp()+interval '25 seconds'),
(decode(repeat('cd',32),'hex'),
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222',
 'gaiz_verify_worker','synthetic-issuer',clock_timestamp()+interval '25 seconds');
COMMIT;

-- A worker cannot see or consume another tenant's challenge.
BEGIN;
SET LOCAL ROLE gaiz_verify_worker;
SELECT set_config('app.tenant_id','22222222-2222-4222-8222-222222222222',true);
DO $$
DECLARE row_count integer;
BEGIN
 SELECT COUNT(*) INTO row_count FROM gaiz_workload_challenges;
 IF row_count <> 0 THEN RAISE EXCEPTION 'Cross-tenant challenge visible'; END IF;
 UPDATE gaiz_workload_challenges SET consumed_at=clock_timestamp()
 WHERE challenge_sha256=decode(repeat('ab',32),'hex')
   AND consumed_at IS NULL AND expires_at>clock_timestamp();
 GET DIAGNOSTICS row_count=ROW_COUNT;
 IF row_count<>0 THEN RAISE EXCEPTION 'Cross-tenant challenge consumed'; END IF;
END $$;
ROLLBACK;

-- One matching claim succeeds. A second claim with the same digest must
-- update zero rows even in the same transaction.
BEGIN;
SET LOCAL ROLE gaiz_verify_worker;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$
DECLARE row_count integer;
BEGIN
 UPDATE gaiz_workload_challenges SET consumed_at=clock_timestamp()
 WHERE challenge_sha256=decode(repeat('ab',32),'hex')
   AND tenant_id='11111111-1111-4111-8111-111111111111'
   AND purpose='gaiz_verify_worker'
   AND consumed_at IS NULL AND expires_at>clock_timestamp();
 GET DIAGNOSTICS row_count=ROW_COUNT;
 IF row_count<>1 THEN RAISE EXCEPTION 'Expected one first claim, got %',row_count; END IF;
 UPDATE gaiz_workload_challenges SET consumed_at=clock_timestamp()
 WHERE challenge_sha256=decode(repeat('ab',32),'hex')
   AND consumed_at IS NULL AND expires_at>clock_timestamp();
 GET DIAGNOSTICS row_count=ROW_COUNT;
 IF row_count<>0 THEN RAISE EXCEPTION 'Replay was accepted'; END IF;
END $$;
COMMIT;

-- The second digest is consumed only within an aborted transaction.
-- Its claim must be available again after rollback.
BEGIN;
SET LOCAL ROLE gaiz_verify_worker;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$
DECLARE row_count integer;
BEGIN
 UPDATE gaiz_workload_challenges SET consumed_at=clock_timestamp()
 WHERE challenge_sha256=decode(repeat('cd',32),'hex')
   AND consumed_at IS NULL AND expires_at>clock_timestamp();
 GET DIAGNOSTICS row_count=ROW_COUNT;
 IF row_count<>1 THEN RAISE EXCEPTION 'Rollback candidate claim not acquired'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE gaiz_verify_worker;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$
DECLARE row_count integer;
BEGIN
 UPDATE gaiz_workload_challenges SET consumed_at=clock_timestamp()
 WHERE challenge_sha256=decode(repeat('cd',32),'hex')
   AND consumed_at IS NULL AND expires_at>clock_timestamp();
 GET DIAGNOSTICS row_count=ROW_COUNT;
 IF row_count<>1 THEN RAISE EXCEPTION 'Rollback did not restore unconsumed digest'; END IF;
END $$;
COMMIT;

DROP TABLE gaiz_workload_challenges;
DROP ROLE gaiz_challenge_issuer;
DROP ROLE gaiz_verify_worker;
DROP ROLE gaiz_execute_worker;
SELECT 'PASS: GAIZ disposable PostgreSQL challenge replay, RLS, rollback acceptance' AS result;
