-- REVIEW ONLY / NOT AN APPLIED MIGRATION.
-- Standalone ORGAIZ sessions are not EPMO sessions or tenant memberships.
-- Proposed alongside PROPOSED_ORGAIZ_COMMERCE_SCHEMA.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS orgaiz_customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES orgaiz_customers(id),
  token_digest char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS orgaiz_customer_sessions_owner_idx
  ON orgaiz_customer_sessions(customer_id,expires_at DESC);
CREATE INDEX IF NOT EXISTS orgaiz_customer_sessions_active_idx
  ON orgaiz_customer_sessions(expires_at) WHERE revoked_at IS NULL;
ALTER TABLE orgaiz_customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_customer_sessions FORCE ROW LEVEL SECURITY;
-- Intentionally NO permissive RLS policies or grants. DB owner/security
-- must review a dedicated service-role policy, revocation, cleanup, audit,
-- retention, backups, concurrency and tenant separation before adoption.
-- Never grant this table to anonymous, marketing-site or EPMO tenant roles.
ROLLBACK;
