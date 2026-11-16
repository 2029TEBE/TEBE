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
  verification_status text NOT NULL CHECK
    (verification_status IN ('pending','verified','invalid','unsupported','untrusted','tenant_mismatch')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, issuer_key_id, artifact_id),
  UNIQUE (tenant_id, envelope_sha256),
  UNIQUE (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS gaiz_import_jobs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  artifact_ref uuid NOT NULL,
  state text NOT NULL CHECK
    (state IN ('quarantined','verified','pending_approval','approved','rejected','importing','imported','failed')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  requested_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  idempotency_key text NOT NULL,
  mapped_schema_version integer,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (artifact_ref, tenant_id) REFERENCES gaiz_artifacts(id, tenant_id)
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
