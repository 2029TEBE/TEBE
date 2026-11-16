-- REVIEW PROPOSAL ONLY: NOT INCLUDED IN THE EXECUTABLE MIGRATION LEDGER.
-- Requires DBA/security review, disposable-tenant testing, and RLS policy
-- comparison against packages/db/sql/rls.sql before integration.
-- Do not run against production.
CREATE TABLE IF NOT EXISTS gaiz_artifacts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  artifact_id text NOT NULL,
  issuer_key_id text NOT NULL,
  envelope_sha256 char(64) NOT NULL,
  content_integrity_verified_at timestamptz,
  verification_status text NOT NULL CHECK
    (verification_status IN ('pending','verified','invalid','unsupported','untrusted','tenant_mismatch')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, issuer_key_id, artifact_id),
  UNIQUE (tenant_id, envelope_sha256),
  UNIQUE (id, tenant_id)
);

-- The following is an isolated ciphertext quarantine table, NOT a metadata or key table.
-- All bytes here are UNTRUSTED and must not be parsed without independent
-- signature, tenant and AEAD validation. Access is server-only.
-- Use a separately approved encrypted-at-rest PostgreSQL volume and retention
-- policy; delete ciphertext by a reviewed privileged expiry job.
CREATE TABLE IF NOT EXISTS gaiz_quarantine_blobs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  envelope_sha256 char(64) NOT NULL CHECK (envelope_sha256 ~ '^[0-9a-f]{64}$'),
  envelope_bytes bytea NOT NULL CHECK (
    octet_length(envelope_bytes) > 6 AND octet_length(envelope_bytes) <= 8388608
  ),
  content_length integer NOT NULL CHECK (content_length > 6 AND content_length <= 8388608),
  state text NOT NULL DEFAULT 'quarantined' CHECK (
    state IN ('quarantined', 'verified', 'rejected', 'expired')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (id, tenant_id),
  CHECK (content_length = octet_length(envelope_bytes))
);
CREATE INDEX IF NOT EXISTS gaiz_quarantine_expiry_idx
  ON gaiz_quarantine_blobs (expires_at);


CREATE TABLE IF NOT EXISTS gaiz_import_jobs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  quarantine_ref uuid NOT NULL,
  artifact_ref uuid,
  state text NOT NULL CHECK
    (state IN ('quarantined','verified','pending_approval','approved','rejected','importing','imported','failed')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  requested_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approval_decided_at timestamptz,
  idempotency_key text NOT NULL,
  idempotency_request_sha256 char(64) NOT NULL,
  mapped_schema_version integer,
  mapping_validated_at timestamptz,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, quarantine_ref),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (quarantine_ref, tenant_id) REFERENCES gaiz_quarantine_blobs(id, tenant_id),
  FOREIGN KEY (artifact_ref, tenant_id) REFERENCES gaiz_artifacts(id, tenant_id),
  CHECK (state = 'quarantined' OR artifact_ref IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS gaiz_export_jobs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  state text NOT NULL CHECK (state IN ('pending','packaging','ready','failed')),
  format text NOT NULL CHECK (format IN ('pdf','html','gaiz')),
  requested_by uuid NOT NULL REFERENCES users(id),
  idempotency_key text NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS gaiz_decisions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  import_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  outcome text NOT NULL CHECK (outcome IN ('approved','rejected')),
  comment text,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (import_id, tenant_id) REFERENCES gaiz_import_jobs(id, tenant_id)
);

-- Requires policy review BEFORE executing any CREATE TABLE above:
-- tables must be FORCE ROW LEVEL SECURITY, non-owner app role only,
-- with tenant-scoped USING and WITH CHECK matching the established RLS model.
-- An independent assertion must prove no cross-tenant joins, updates or
-- idempotency/replay namespace collisions are possible.
-- Artifact bytes/DEKs must NOT be written into these metadata tables.

-- Enforce RLS before app-role permissions are granted. In a disposable DB,
-- apply the *existing approved* packages/db/sql/rls.sql after table creation.
-- REVOKE SELECT(envelope_bytes) for any role that does not directly process
-- quarantined ciphertext. Do not expose bytea in GET API responses.
-- Only scoped worker identities with a documented retention and access policy
-- may read ciphertext; tenant/application principals are not sufficient.
