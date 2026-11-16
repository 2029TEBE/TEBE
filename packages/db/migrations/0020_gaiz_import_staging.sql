-- GAIZ2 development-only metadata staging.
-- Not applied automatically. No ciphertext, plaintext, recipient private key or DEK is stored.
CREATE TABLE IF NOT EXISTS public.gaiz_import_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 artifact_id text NOT NULL CHECK (length(artifact_id) BETWEEN 1 AND 128),
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 issuer_id text NOT NULL CHECK (length(issuer_id) BETWEEN 1 AND 128),
 requested_by uuid NOT NULL REFERENCES public.users(id),
 reviewed_by uuid REFERENCES public.users(id),
 status text NOT NULL DEFAULT 'pending'
   CHECK (status IN ('pending','approved','rejected','expired')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
 reviewed_at timestamptz,
 review_note text CHECK (review_note IS NULL OR length(review_note) <= 500),
 CONSTRAINT gaiz_import_requests_tenant_hash_unique UNIQUE (tenant_id, sha256),
 CONSTRAINT gaiz_import_requests_tenant_artifact_unique UNIQUE (tenant_id, artifact_id),
 CONSTRAINT gaiz_import_requests_review_state CHECK (
  (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
  OR
  (status IN ('approved','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by <> requested_by)
  OR
  (status = 'expired' AND reviewed_by IS NULL AND reviewed_at IS NULL)
 )
);
CREATE INDEX IF NOT EXISTS gaiz_import_requests_tenant_status_idx ON public.gaiz_import_requests
 (tenant_id,status,requested_at DESC);
ALTER TABLE public.gaiz_import_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaiz_import_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY gaiz_import_requests_tenant_only ON public.gaiz_import_requests
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
-- Metadata changes must not be deleted or rebound across tenants by the application role.
-- Existing DB roles/grants must be reviewed in the deployment's privilege policy.
-- Required DB migration and RLS validation before GAIZ_STAGING_ENABLED can be used.
