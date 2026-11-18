-- GAIZ2 REVIEW PROPOSAL ONLY. DO NOT APPLY TO PRODUCTION.
-- Requires DBA review against the actual schema, RLS installer, and worker roles.
-- No key material, private keys, DEKs, wrapped DEKs or KMS credentials stored.
-- Application and verifier workers must never self-approve recipient status.
BEGIN;
CREATE TABLE IF NOT EXISTS gaiz2_recipient_key_registry (
 tenant_id uuid NOT NULL,
 recipient_key_id text NOT NULL CHECK (recipient_key_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
 key_version text NOT NULL CHECK (key_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
 kms_key_reference text NOT NULL,
 state text NOT NULL CHECK (state IN ('pending','active','suspended','revoked','retired')),
 not_before timestamptz NOT NULL,
 not_after timestamptz NOT NULL,
 revoked_at timestamptz,
 revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,recipient_key_id,key_version),
 CHECK(not_after > not_before),
 CHECK(state <> 'revoked' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS gaiz2_recipient_key_active_version
 ON gaiz2_recipient_key_registry(tenant_id,recipient_key_id)
 WHERE state='active';
CREATE TABLE IF NOT EXISTS gaiz2_recipient_key_events (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,
 recipient_key_id text NOT NULL,
 key_version text NOT NULL,
 event_type text NOT NULL CHECK (event_type IN
   ('provisioned','activated','suspended','revoked','retired','rotated')),
 actor_id uuid NOT NULL,
 reason_code text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,recipient_key_id,key_version) REFERENCES
  gaiz2_recipient_key_registry(tenant_id,recipient_key_id,key_version)
);
ALTER TABLE gaiz2_recipient_key_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz2_recipient_key_registry FORCE ROW LEVEL SECURITY;
ALTER TABLE gaiz2_recipient_key_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaiz2_recipient_key_events FORCE ROW LEVEL SECURITY;
-- Default deny without explicit policies; no public or app grants.
REVOKE ALL ON gaiz2_recipient_key_registry FROM PUBLIC;
REVOKE ALL ON gaiz2_recipient_key_events FROM PUBLIC;
-- Existing application role is expected, but confirm on isolated DB first.
-- REVOKE ALL ON gaiz2_recipient_key_registry FROM pmo_app;
-- REVOKE ALL ON gaiz2_recipient_key_events FROM pmo_app;
COMMIT;

-- SECURITY GATES BEFORE APPROVAL:
-- 1. Never grant interactive/API roles update privileges or membership in
--    custodian/registry roles. Bind an independently authenticated registrar.
-- 2. Define FORCE RLS policies and restricted roles after tenant-isolation
--    acceptance, avoiding table-owner or BYPASSRLS service identities.
-- 3. Check active version, tenant, revision and clock *inside* a durable
--    release transaction; lock the row and repeat checks at key-use time.
-- 4. Implement atomic one-use release counter/token tied to the custody grant,
--    assignment and KMS operation ID. Roll back on failure, audit on success.
-- 5. Ensure revocation takes precedence over outstanding grants and cached
--    authorizations; define key-use concurrency and fail-closed KMS outages.
-- 6. Test rotations with in-flight workers, replay attempts and tenant RLS.
-- 7. No KMS key reference should be interpreted as proof of key ownership.
