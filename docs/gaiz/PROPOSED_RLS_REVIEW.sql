-- GAIZ RLS REVIEW DRAFT ONLY. DO NOT EXECUTE OR INCLUDE IN MIGRATIONS.
-- Preconditions:
--   1. Proposed GAIZ tables are migrated in a disposable test database.
--   2. Existing public.app_current_tenant() exists and returns the
--      transaction-local tenant ID or NULL.
--   3. pmo_app has neither SUPERUSER nor BYPASSRLS privilege.
--   4. Changes reviewed with packages/db/sql/rls.sql and database owner.
--
-- All four GAIZ tables contain tenant_id. App cannot use a global owner scope.

ALTER TABLE gaiz_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE gaiz_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_import_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE gaiz_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_export_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE gaiz_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_decisions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON gaiz_artifacts
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON gaiz_import_jobs
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON gaiz_export_jobs
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON gaiz_decisions
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

-- Immutable decisions and immutable artifact identity (enforce more narrowly
-- with column grants and DB triggers as part of a reviewed migration).
REVOKE UPDATE, DELETE ON gaiz_decisions FROM pmo_app;
REVOKE DELETE ON gaiz_artifacts FROM pmo_app;
REVOKE DELETE ON gaiz_import_jobs, gaiz_export_jobs FROM pmo_app;

-- Reviewer must add disposable DB assertions that prove:
--  A. tenant A cannot SELECT, INSERT, UPDATE, DELETE tenant B GAIZ rows
--  B. missing tenant context returns zero rows and forbids writes
--  C. foreign artifact FK fails even when row IDs are known
--  D. gaiz_decisions cannot UPDATE or DELETE as pmo_app
--  E. disabling app tenant context never causes a privileged fallback
--  F. job revision and replay claims remain atomic under parallel requests
--
-- WARNING: This is illustrative, NOT ready to execute. If the existing RLS
-- installer has already created tenant_isolation policies, CREATE POLICY will
-- fail on duplicate names. Migration author must use one approved policy
-- installation path, never manually disabling RLS to resolve collisions.
