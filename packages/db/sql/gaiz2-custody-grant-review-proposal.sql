-- REVIEW ONLY. Never apply automatically to production.
-- Requires DBA-reviewed dedicated gaiz_verify_worker non-owner NOBYPASSRLS
-- and existing pmo_app role. Grant replay is claimed in the SAME transaction
-- as assignment claim and the operation; a failed operation rolls back both.
BEGIN;
CREATE TABLE IF NOT EXISTS gaiz2_custody_grant_claims(
 token_sha256 bytea PRIMARY KEY CHECK(octet_length(token_sha256)=32),
 tenant_id uuid NOT NULL,
 worker_id uuid NOT NULL,
 work_item_id uuid NOT NULL,
 assignment_id uuid NOT NULL,
 issuer_id text NOT NULL CHECK(length(issuer_id) BETWEEN 1 AND 128),
 artifact_id text NOT NULL CHECK(length(artifact_id) BETWEEN 1 AND 128),
 envelope_sha256 bytea NOT NULL CHECK(octet_length(envelope_sha256)=32),
 recipient_key_id text NOT NULL CHECK(length(recipient_key_id) BETWEEN 1 AND 128),
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 CONSTRAINT gaiz2_custody_claim_valid_expiry CHECK(expires_at>claimed_at AND expires_at<=claimed_at+interval '30 seconds')
);
ALTER TABLE gaiz2_custody_grant_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz2_custody_grant_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON gaiz2_custody_grant_claims FROM PUBLIC;
REVOKE ALL ON gaiz2_custody_grant_claims FROM pmo_app;
CREATE POLICY gaiz2_custody_verified_worker_claim ON gaiz2_custody_grant_claims
 FOR INSERT TO gaiz_verify_worker WITH CHECK (
   tenant_id::text=current_setting('app.tenant_id',true)
   AND current_user='gaiz_verify_worker'
   AND expires_at>clock_timestamp()
 );
-- INSERT ... RETURNING requires SELECT privileges for returned columns.
CREATE POLICY gaiz2_custody_verified_worker_read ON gaiz2_custody_grant_claims
 FOR SELECT TO gaiz_verify_worker USING(
 tenant_id::text=current_setting('app.tenant_id',true)
 AND current_user='gaiz_verify_worker'
 );
GRANT INSERT ON gaiz2_custody_grant_claims TO gaiz_verify_worker;
GRANT SELECT(token_sha256) ON gaiz2_custody_grant_claims TO gaiz_verify_worker;
COMMIT;
-- Security release blockers:
-- - Test concurrent unique digest contention and transaction rollback.
-- - Test tenant RLS and deny app role in disposable PostgreSQL.
-- - Enforce externally authenticated workload identity and independent
--   assignment claim; a valid signature alone MUST NEVER release keys.
-- - Preserve replay marker at least through expiry + abuse/recovery window.
-- - Never enable KMS, route, or real decryption solely from this ledger.
