-- GAIZ workload challenge replay ledger: REVIEW-ONLY SQL PROPOSAL.
-- NEVER add to automatic migrations until roles, RLS, grants and owner
-- permissions have been verified against a disposable PostgreSQL instance.
-- Authenticated ingress MUST use a distinct gaiz_challenge_issuer role.
-- Verifier/executor MUST connect as their own non-owner, NOBYPASSRLS roles.
-- Database owner and every worker credential must remain separate.
BEGIN;

CREATE TABLE IF NOT EXISTS gaiz_workload_challenges (
  challenge_sha256 bytea PRIMARY KEY,
  tenant_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  work_item_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('gaiz_verify_worker','gaiz_execute_worker')),
  credential_issuer text NOT NULL CHECK (length(credential_issuer) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT gaiz_challenge_sha256_len CHECK (octet_length(challenge_sha256) = 32),
  CONSTRAINT gaiz_challenge_time_bounds CHECK (expires_at > created_at AND expires_at <= created_at + interval '60 seconds'),
  CONSTRAINT gaiz_challenge_consumed_not_before_created CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

ALTER TABLE gaiz_workload_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz_workload_challenges FORCE ROW LEVEL SECURITY;

-- The ingress is responsible for generating a fresh 256-bit challenge,
-- inserting SHA256(challenge) BEFORE sending the raw challenge to the worker,
-- enforcing one active challenge per request and keeping issuance audited.
-- We intentionally DO NOT grant broad PUBLIC/pmo_app access.
REVOKE ALL ON gaiz_workload_challenges FROM PUBLIC;
REVOKE ALL ON gaiz_workload_challenges FROM pmo_app;

-- Role provisioning (NOLOGIN, NOBYPASSRLS, least privilege) must be reviewed
-- and completed independently. These policies fail migration if absent.
CREATE POLICY gaiz_workload_challenge_issuer_insert ON gaiz_workload_challenges
  FOR INSERT TO gaiz_challenge_issuer
  WITH CHECK (
    purpose IN ('gaiz_verify_worker','gaiz_execute_worker')
    AND consumed_at IS NULL
    AND expires_at > clock_timestamp()
    AND expires_at <= clock_timestamp() + interval '60 seconds'
  );
GRANT INSERT ON gaiz_workload_challenges TO gaiz_challenge_issuer;

CREATE POLICY gaiz_workload_challenge_worker_select ON gaiz_workload_challenges
  FOR SELECT TO gaiz_verify_worker,gaiz_execute_worker
  USING (
    tenant_id::text = current_setting('app.tenant_id',true)
    AND purpose = current_user
  );
CREATE POLICY gaiz_workload_challenge_worker_update ON gaiz_workload_challenges
  FOR UPDATE TO gaiz_verify_worker,gaiz_execute_worker
  USING (
    tenant_id::text = current_setting('app.tenant_id',true)
    AND purpose = current_user
    AND consumed_at IS NULL
    AND expires_at > clock_timestamp()
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id',true)
    AND purpose = current_user
    AND consumed_at IS NOT NULL
  );
GRANT SELECT ON gaiz_workload_challenges TO gaiz_verify_worker,gaiz_execute_worker;
GRANT UPDATE(consumed_at) ON gaiz_workload_challenges TO gaiz_verify_worker,gaiz_execute_worker;

COMMIT;

-- Non-production validation required:
-- * Verify non-owner, non-superuser, NOBYPASSRLS roles exist.
-- * Verify pmo_app and other tenants cannot INSERT/SELECT/UPDATE.
-- * Concurrent claims for the same challenge produce exactly one success.
-- * Rollback of downstream operation also rolls back consumed_at.
-- * Expired/revoked credentials and missing tenant GUC fail.
-- * Cleanup never revives an expired or consumed challenge.
-- * Do NOT deploy this proposal as an automatic migration.
