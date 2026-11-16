-- REVIEW ONLY — Do not apply this SQL; it is intentionally rolled back.
-- Prerequisite: reviewed ORGAIZ commerce proposal, dedicated service roles and RLS.
-- Existing commerce schema does NOT yet contain these columns or tables.
BEGIN;
ALTER TABLE orgaiz_jobs
 ADD COLUMN IF NOT EXISTS worker_key text,
 ADD COLUMN IF NOT EXISTS format text CHECK(format IN ('html','pdf','gaiz')),
 ADD COLUMN IF NOT EXISTS inputs jsonb,
 ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
 ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 ADD COLUMN IF NOT EXISTS lease_digest char(64),
 ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS orgaiz_jobs_claim_idx
 ON orgaiz_jobs(state,created_at,id)
 WHERE state IN ('queued','processing');
CREATE TABLE IF NOT EXISTS orgaiz_order_entitlements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES orgaiz_orders(id),
 customer_id uuid NOT NULL REFERENCES orgaiz_customers(id),
 status text NOT NULL CHECK(status IN ('active','revoked')),
 granted_by text NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,customer_id)
);
CREATE TABLE IF NOT EXISTS orgaiz_artifact_staging(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_id uuid NOT NULL REFERENCES orgaiz_jobs(id),
 customer_id uuid NOT NULL REFERENCES orgaiz_customers(id),
 format text NOT NULL CHECK(format IN ('html','pdf','gaiz')),
 sha256 char(64) NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=10000000),
 encrypted_object_key text NOT NULL UNIQUE,
 state text NOT NULL CHECK(state IN ('staged','committed','orphaned')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orgaiz_artifact_staging_cleanup_idx
 ON orgaiz_artifact_staging(state,created_at);
CREATE TABLE IF NOT EXISTS orgaiz_job_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_id uuid NOT NULL REFERENCES orgaiz_jobs(id),
 customer_id uuid REFERENCES orgaiz_customers(id),
 event_type text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orgaiz_job_audit_job_idx
 ON orgaiz_job_audit(job_id,created_at);
ALTER TABLE orgaiz_order_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_artifact_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_job_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_order_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_artifact_staging FORCE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_job_audit FORCE ROW LEVEL SECURITY;
-- NO policies created: fail-closed. Need worker ownership, least privilege,
-- entitlement provenance, revocation and accounting policy review.
-- Additional invariants needed before release:
--  * unique job/order ownership, format/worker-key catalogue binding
--  * customer/worker scoped RLS, no public privileges, no BYPASSRLS
--  * recipient-key custody and trusted issuer signing for GAIZ2
--  * lease cleanup and bounded retry rules
--  * atomic ledger/audit writes and verified entitlement provenance
ROLLBACK;
