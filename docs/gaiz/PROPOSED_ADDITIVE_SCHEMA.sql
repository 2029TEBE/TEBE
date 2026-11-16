-- REVIEW-ONLY PROPOSAL: DO NOT APPLY AS A MIGRATION.
-- Reconcile with real TEBE DB, RLS and worker grants before disposable testing.
-- No deployment or database modifications are authorized by this file.

-- Existing documents/projects use single-column UUID primary keys. Composite
-- references below additionally bind the target to its tenant. These two
-- indexes are additive proposals, not permission to alter production tables.
CREATE UNIQUE INDEX projects_id_tenant_gaiz_fk ON projects (id, tenant_id);
CREATE UNIQUE INDEX documents_id_tenant_gaiz_fk ON documents (id, tenant_id);

-- Untrusted ciphertext is quarantined before issuer and payload verification.
CREATE TABLE gaiz_quarantine_blobs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{16,128}$'),
  envelope_sha256 char(64) NOT NULL CHECK (envelope_sha256 ~ '^[0-9a-f]{64}$'),
  envelope_bytes bytea NOT NULL,
  content_length integer NOT NULL CHECK (content_length BETWEEN 7 AND 8388608),
  state text NOT NULL DEFAULT 'quarantined'
    CHECK (state IN ('quarantined','verified','rejected','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (id, tenant_id),
  CHECK (content_length = octet_length(envelope_bytes))
);
CREATE INDEX gaiz_quarantine_expiry_idx ON gaiz_quarantine_blobs (expires_at);

-- Artifact identities can only be established by a trusted verifier worker.
CREATE TABLE gaiz_artifacts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  artifact_id text NOT NULL CHECK (char_length(artifact_id) BETWEEN 1 AND 256),
  issuer_key_id text NOT NULL,
  envelope_sha256 char(64) NOT NULL CHECK (envelope_sha256 ~ '^[0-9a-f]{64}$'),
  content_integrity_verified_at timestamptz,
  verification_status text NOT NULL
    CHECK (verification_status IN ('pending','verified','invalid',
      'unsupported','untrusted','tenant_mismatch')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, issuer_key_id, artifact_id),
  UNIQUE (tenant_id, envelope_sha256),
  UNIQUE (id, tenant_id)
);

CREATE TABLE gaiz_import_jobs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  quarantine_ref uuid NOT NULL,
  artifact_ref uuid,
  state text NOT NULL CHECK
    (state IN ('quarantined','verified','pending_approval','approved',
      'rejected','importing','imported','failed')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  requested_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approval_decided_at timestamptz,
  idempotency_key text NOT NULL,
  idempotency_request_sha256 char(64) NOT NULL
    CHECK (idempotency_request_sha256 ~ '^[0-9a-f]{64}$'),
  mapped_schema_version integer,
  mapping_validated_at timestamptz,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, quarantine_ref),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (quarantine_ref, tenant_id)
    REFERENCES gaiz_quarantine_blobs(id, tenant_id),
  FOREIGN KEY (artifact_ref, tenant_id) REFERENCES gaiz_artifacts(id, tenant_id),
  -- Early rejection and verification failure may occur before artifact_ref exists.
  CHECK (state IN ('quarantined','rejected','failed') OR artifact_ref IS NOT NULL),
  CHECK (state NOT IN ('approved','importing','imported') OR approved_by IS NOT NULL)
);

-- Privileged verifier output, not directly writable by the customer API role.
CREATE TABLE gaiz_import_proposals (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  import_id uuid NOT NULL,
  source_artifact_sha256 char(64) NOT NULL
    CHECK (source_artifact_sha256 ~ '^[0-9a-f]{64}$'),
  schema_version integer NOT NULL CHECK (schema_version = 1),
  document_title text NOT NULL CHECK (char_length(document_title) BETWEEN 1 AND 200),
  document_summary text NOT NULL CHECK (char_length(document_summary) BETWEEN 1 AND 5000),
  target_project_id uuid,
  validated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, import_id),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (import_id, tenant_id) REFERENCES gaiz_import_jobs(id, tenant_id),
  FOREIGN KEY (target_project_id, tenant_id)
    REFERENCES projects(id, tenant_id)
);
-- The executor also rechecks the target project in its own transaction.

CREATE TABLE gaiz_import_receipts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  import_id uuid NOT NULL,
  document_id uuid NOT NULL,
  envelope_sha256 char(64) NOT NULL CHECK (envelope_sha256 ~ '^[0-9a-f]{64}$'),
  correlation_id uuid NOT NULL,
  executed_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, import_id),
  UNIQUE (tenant_id, document_id),
  FOREIGN KEY (import_id, tenant_id) REFERENCES gaiz_import_jobs(id, tenant_id),
  FOREIGN KEY (document_id, tenant_id)
    REFERENCES documents(id, tenant_id)
);

CREATE TABLE gaiz_export_jobs (
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

CREATE TABLE gaiz_decisions (
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

-- Server-issued, one-time assignment claims. Workers must insert this row in
-- the *same database transaction* as the corresponding verification/import
-- effect. Rolling back the effect rolls back the claim, allowing safe retry.
-- Never allow any client-facing role to insert/inspect/delete these rows.
CREATE TABLE gaiz_worker_assignment_claims (
  assignment_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  worker_id uuid NOT NULL,
  work_item_id uuid NOT NULL,
  purpose text NOT NULL CHECK
    (purpose IN ('gaiz_verify_worker','gaiz_execute_worker')),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > claimed_at),
  UNIQUE (assignment_id, tenant_id)
);
CREATE INDEX gaiz_worker_assignment_claims_tenant_idx
  ON gaiz_worker_assignment_claims (tenant_id, claimed_at);

-- Before using any of this: review real DB privileges, FORCE RLS, tenant-scoped
-- FKs, trusted verifier worker roles, unforgeable evidence, and retention.
-- No secrets/DEKs/plaintext may be written to these metadata tables.
