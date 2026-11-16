-- GAIZ2 custody handoff attempt reservation. DRAFT / NOT APPLIED.
-- Contains only opaque identifiers and hashes. Never decryption keys or plaintext.
ALTER TABLE public.gaiz_import_requests
  ADD CONSTRAINT gaiz_import_requests_tenant_id_unique UNIQUE (tenant_id,id);
CREATE TABLE IF NOT EXISTS public.gaiz_custody_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  review_id uuid NOT NULL,
  CONSTRAINT gaiz_custody_attempt_tenant_review_fk
    FOREIGN KEY (tenant_id,review_id) REFERENCES public.gaiz_import_requests(tenant_id,id) ON DELETE CASCADE,
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  recipient_key_id text NOT NULL CHECK (length(recipient_key_id) BETWEEN 1 AND 128),
  requested_by uuid NOT NULL REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved','validated','denied')),
  report_sha256 text CHECK (report_sha256 IS NULL OR report_sha256 ~ '^[a-f0-9]{64}$'),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT gaiz_custody_attempt_review_unique UNIQUE (tenant_id, review_id),
  CONSTRAINT gaiz_custody_attempt_state CHECK (
    (status='reserved' AND completed_at IS NULL AND report_sha256 IS NULL)
    OR (status='validated' AND completed_at IS NOT NULL AND report_sha256 IS NOT NULL)
    OR (status='denied' AND completed_at IS NOT NULL AND report_sha256 IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS gaiz_custody_attempts_tenant_created_idx
  ON public.gaiz_custody_attempts (tenant_id,reserved_at DESC);
ALTER TABLE public.gaiz_custody_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaiz_custody_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY gaiz_custody_attempts_tenant_only ON public.gaiz_custody_attempts
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
-- Deployment gate: role privileges and tenant integrity need independent review.
