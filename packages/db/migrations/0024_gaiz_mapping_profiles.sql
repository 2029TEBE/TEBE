-- GAIZ2 mapping profiles: metadata-only, tenant bound, no decrypted fields.
-- DRAFT; require isolated PostgreSQL and RLS acceptance before applying.
CREATE TABLE public.gaiz_mapping_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id text NOT NULL CHECK (profile_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  target_kind text NOT NULL CHECK (target_kind IN ('project','portfolio')),
  field_mappings jsonb NOT NULL CHECK (
    (target_kind='project' AND field_mappings='["project.name"]'::jsonb)
    OR (target_kind='portfolio' AND field_mappings='["portfolio.description"]'::jsonb)
  ),
  requested_by uuid NOT NULL REFERENCES public.users(id),
  reviewed_by uuid REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','revoked')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT gaiz_mapping_profiles_tenant_profile_unique UNIQUE (tenant_id,profile_id),
  CONSTRAINT gaiz_mapping_profiles_review_state CHECK (
     (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
     OR (status IN ('approved','rejected','revoked')
       AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
       AND reviewed_by <> requested_by)
  )
);
CREATE INDEX gaiz_mapping_profiles_tenant_status_idx
  ON public.gaiz_mapping_profiles (tenant_id,status,target_kind);
ALTER TABLE public.gaiz_mapping_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaiz_mapping_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY gaiz_mapping_profiles_tenant_only ON public.gaiz_mapping_profiles
  USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
-- The application role must only INSERT pending profiles and UPDATE review
-- metadata; no general UPDATE/DELETE to rebind approved source mappings.
