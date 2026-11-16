-- GAIZ RLS REVIEW DRAFT ONLY. DO NOT EXECUTE OR INCLUDE IN MIGRATIONS.
-- Preconditions:
--   1. Proposed GAIZ tables are migrated in a disposable test database.
--   2. Existing public.app_current_tenant() exists and returns the
--      transaction-local tenant ID or NULL.
--   3. pmo_app has neither SUPERUSER nor BYPASSRLS privilege.
--   4. Changes reviewed with packages/db/sql/rls.sql and database owner.
--
-- All seven GAIZ tables contain tenant_id. App cannot use a global owner scope.

ALTER TABLE gaiz_quarantine_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_quarantine_blobs FORCE ROW LEVEL SECURITY;
ALTER TABLE gaiz_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE gaiz_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_import_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE gaiz_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_export_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE gaiz_import_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_import_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE gaiz_import_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_import_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE gaiz_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_decisions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON gaiz_quarantine_blobs
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON gaiz_artifacts
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON gaiz_import_jobs
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON gaiz_export_jobs
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON gaiz_import_proposals
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON gaiz_import_receipts
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON gaiz_decisions
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

-- Immutable decisions and immutable artifact identity (enforce more narrowly
-- with column grants and DB triggers as part of a reviewed migration).
REVOKE UPDATE, DELETE ON gaiz_decisions FROM pmo_app;
REVOKE UPDATE, DELETE ON gaiz_import_proposals FROM pmo_app;
REVOKE UPDATE, DELETE ON gaiz_import_receipts FROM pmo_app;
-- Only a separately reviewed verifier service may write verified evidence.
REVOKE INSERT, UPDATE, DELETE ON gaiz_import_proposals FROM pmo_app;
REVOKE INSERT, UPDATE, DELETE ON gaiz_artifacts FROM pmo_app;
-- Receipt creation is part of a privileged, audited import transaction;
-- the active API role must not forge one independently before approval.
-- Design a dedicated executor role/SECURITY DEFINER function with strict
-- checks before lifting this restriction.
REVOKE INSERT ON gaiz_import_receipts FROM pmo_app;
-- The existing pmo_app role must not directly elevate job states, set
-- mapping_validated_at, approved_by or other trusted state columns. Human
-- decision writes must use a dedicated checked transaction with immutable
-- evidence; the current prototype adapter is deliberately disabled.
REVOKE INSERT, UPDATE, DELETE ON gaiz_import_jobs FROM pmo_app;
REVOKE INSERT, UPDATE, DELETE ON gaiz_decisions FROM pmo_app;
REVOKE INSERT, UPDATE, DELETE ON gaiz_export_jobs FROM pmo_app;
-- No GAIZ customer-facing write workflow is activated by these proposals.

REVOKE DELETE ON gaiz_quarantine_blobs FROM pmo_app;
REVOKE DELETE ON gaiz_artifacts FROM pmo_app;
REVOKE DELETE ON gaiz_import_jobs, gaiz_export_jobs FROM pmo_app;

-- IMPORTANT: The baseline RLS installer currently GRANTs SELECT on all tables.
-- Remove that broad table SELECT for quarantine before exposing its bytes:
REVOKE SELECT ON gaiz_quarantine_blobs FROM pmo_app;
GRANT SELECT (id, tenant_id, requested_by, idempotency_key,
              envelope_sha256, content_length, state, created_at, expires_at)
  ON gaiz_quarantine_blobs TO pmo_app;
-- The unregistered prototype adapter currently SELECTs metadata only and
-- INSERTs ciphertext. A future verifier worker must receive a separate
-- narrowly scoped identity and explicit audited byte access; do not grant
-- SELECT(envelope_bytes) to the customer-facing application role.
-- A blanket GRANT SELECT ON ALL TABLES after these statements would undo
-- the restriction; review and test grant ordering in actual migration tooling.

-- Review who may INSERT gaiz_import_proposals: normal API role must NOT
-- be able to mark unverified content as validated or overwrite source hashes.
-- Existing default grants are permissive; a dedicated verifier-worker role
-- and restricted table/column grants are required before executing this DDL.
-- The current executor is UNREGISTERED until trusted worker provenance can
-- be enforced by DB privileges and independent fixture tests.

-- Reviewer must add disposable DB assertions that prove:
--  A. tenant A cannot SELECT, INSERT, UPDATE, DELETE tenant B GAIZ rows
--  B. missing tenant context returns zero rows and forbids writes
--  C. foreign artifact FK fails even when row IDs are known
--  D. gaiz_decisions cannot UPDATE or DELETE as pmo_app
--  E. disabling app tenant context never causes a privileged fallback
--  F. job revision and replay claims remain atomic under parallel requests
--
-- IMPORTANT: the unregistered draft executor currently uses the app DB role.
-- These necessary restrictions intentionally make that draft non-operational
-- until a dedicated, audited execution role is implemented and reviewed.
-- WARNING: This is illustrative, NOT ready to execute. If the existing RLS
-- installer has already created tenant_isolation policies, CREATE POLICY will
-- fail on duplicate names. Migration author must use one approved policy
-- installation path, never manually disabling RLS to resolve collisions.
