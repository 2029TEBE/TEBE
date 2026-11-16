-- GAIZ2 review-only, disposable-DB design. DO NOT RUN IN PRODUCTION.
-- Requires gaiz2-custody-grant-review-proposal.sql and
-- gaiz2-recipient-key-registry-REVIEW-ONLY.sql to be reviewed and applied
-- in an isolated disposable schema first. No automated DDL execution.
-- Only the independent authenticated custody gateway may consume a release.
-- A grant claim is NOT permission to decrypt and there is no plaintext storage.
BEGIN;
CREATE TABLE gaiz2_kms_release_claims (
 tenant_id uuid NOT NULL,
 custody_token_sha256 bytea NOT NULL CHECK (octet_length(custody_token_sha256)=32),
 assignment_id uuid NOT NULL,
 worker_id uuid NOT NULL,
 work_item_id uuid NOT NULL,
 envelope_sha256 bytea NOT NULL CHECK (octet_length(envelope_sha256)=32),
 recipient_key_id text NOT NULL,
 key_version text NOT NULL,
 kms_operation_id uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','denied')),
 consumed_at timestamptz,
 PRIMARY KEY (tenant_id,custody_token_sha256),
 -- The identical signed custody grant must never be used under another tenant.
 UNIQUE (custody_token_sha256),
 UNIQUE (tenant_id,kms_operation_id),
 CHECK (status <> 'consumed' OR consumed_at IS NOT NULL),
 CHECK (status = 'consumed' OR consumed_at IS NULL),
 CHECK (consumed_at IS NULL OR consumed_at >= claimed_at),
 -- Enforce exact assignment / tenant / artifact / recipient metadata in SQL.
 CONSTRAINT gaiz2_release_exact_signed_grant FOREIGN KEY
 (custody_token_sha256,tenant_id,worker_id,work_item_id,assignment_id,envelope_sha256,recipient_key_id)
 REFERENCES gaiz2_custody_grant_claims
 (token_sha256,tenant_id,worker_id,work_item_id,assignment_id,envelope_sha256,recipient_key_id),
 CONSTRAINT gaiz2_release_registered_key FOREIGN KEY
 (tenant_id,recipient_key_id,key_version)
 REFERENCES gaiz2_recipient_key_registry
 (tenant_id,recipient_key_id,key_version)
);
CREATE INDEX gaiz2_kms_release_expiry_idx
 ON gaiz2_kms_release_claims(tenant_id,expires_at);
ALTER TABLE gaiz2_kms_release_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz2_kms_release_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON gaiz2_kms_release_claims FROM PUBLIC;
-- NO GRANTS, POLICIES, SECURITY DEFINER FUNCTIONS OR APP ROUTES:
-- default deny is intentional. DBA must explicitly design the independent
-- custody gateway role and tenant RLS policies after isolated acceptance.
COMMIT;

-- Required transaction contract for the reviewed custodian:
-- A. Authenticate worker via independent peer credential, verify issuer and
--    active worker assignment; compare exact tenant/worker/work item/artifact.
-- B. BEGIN; SET LOCAL tenant to trusted, authenticated value (not HTTP data).
-- C. SELECT recipient key registry row FOR UPDATE; ensure active exact version,
--    valid at DB clock and not revoked, with an independent registrar trust.
-- D. Verify one-time grant was claimed by gaiz_verify_worker and corresponds
--    to the same assignment / recipient / signed envelope. Lock both claims.
-- E. INSERT a globally unique custody-token release claim reserved for one operation; duplicate or
--    revoked/expired/conflicting rows MUST fail closed. Do not COMMIT a release
--    authorization before independent KMS policy evaluation is complete.
-- F. Recheck authoritative key revocation at KMS key use; never rely on a
--    cached registry state, client flag or signed grant as sole permission.
-- G. Record consumed/denied status and immutable audit for exactly one use.
--    KMS outage, timeout and ambiguous outcomes require manual reconciliation,
--    never an automatic second unwrap of the same grant.
-- H. Only a dedicated isolated custody service may access a DEK in memory;
--    never deliver it to ordinary API/frontend/database rows.
-- I. Introduce production DDL only through reviewed migrations and tested RLS.
