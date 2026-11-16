-- GAIZ2 import authorization metadata only. DRAFT, DO NOT APPLY TO PRODUCTION.
-- Authorizes a review decision, NEVER a project/portfolio mutation.
ALTER TABLE public.gaiz_custody_attempts
  ADD CONSTRAINT gaiz_custody_attempts_tenant_review_id_unique UNIQUE(tenant_id,review_id,id);
CREATE TABLE IF NOT EXISTS public.gaiz_import_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staging_review_id uuid NOT NULL,
  custody_attempt_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('project','portfolio')),
  target_id uuid NOT NULL,
  target_snapshot_sha256 text NOT NULL CHECK (target_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  preview_sha256 text NOT NULL CHECK (preview_sha256 ~ '^[a-f0-9]{64}
  requested_by uuid NOT NULL REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+ interval '30 minutes'),
  reviewed_at timestamptz,
  CONSTRAINT gaiz_import_authorization_review_fk FOREIGN KEY (tenant_id,staging_review_id)
    REFERENCES public.gaiz_import_requests(tenant_id,id) ON DELETE CASCADE,
  -- Composite FK prevents a same-tenant custody attempt from being rebound
  -- to an unrelated GAIZ staging review.
  CONSTRAINT gaiz_import_authorization_custody_fk
    FOREIGN KEY (tenant_id,staging_review_id,custody_attempt_id)
    REFERENCES public.gaiz_custody_attempts(tenant_id,review_id,id) ON DELETE CASCADE,
  CONSTRAINT gaiz_import_authorization_review_once UNIQUE(tenant_id,staging_review_id),
  CONSTRAINT gaiz_import_authorization_state CHECK (
    (status='pending' AND approved_by IS NULL AND reviewed_at IS NULL)
    OR (status IN ('approved','rejected') AND approved_by IS NOT NULL
      AND reviewed_at IS NOT NULL AND approved_by <> requested_by)
  )
);
CREATE INDEX IF NOT EXISTS gaiz_import_authorizations_tenant_pending_idx
 ON public.gaiz_import_authorizations (tenant_id,status,requested_at DESC);
ALTER TABLE public.gaiz_import_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaiz_import_authorizations FORCE ROW LEVEL SECURITY;
CREATE POLICY gaiz_import_authorizations_tenant_only ON public.gaiz_import_authorizations
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
-- Production gates: apply only after isolated tenant-RLS and role-grant review.
),
  mapping_profile_id text NOT NULL CHECK (mapping_profile_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}
  requested_by uuid NOT NULL REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+ interval '30 minutes'),
  reviewed_at timestamptz,
  CONSTRAINT gaiz_import_authorization_review_fk FOREIGN KEY (tenant_id,staging_review_id)
    REFERENCES public.gaiz_import_requests(tenant_id,id) ON DELETE CASCADE,
  -- Composite FK prevents a same-tenant custody attempt from being rebound
  -- to an unrelated GAIZ staging review.
  CONSTRAINT gaiz_import_authorization_custody_fk
    FOREIGN KEY (tenant_id,staging_review_id,custody_attempt_id)
    REFERENCES public.gaiz_custody_attempts(tenant_id,review_id,id) ON DELETE CASCADE,
  CONSTRAINT gaiz_import_authorization_review_once UNIQUE(tenant_id,staging_review_id),
  CONSTRAINT gaiz_import_authorization_state CHECK (
    (status='pending' AND approved_by IS NULL AND reviewed_at IS NULL)
    OR (status IN ('approved','rejected') AND approved_by IS NOT NULL
      AND reviewed_at IS NOT NULL AND approved_by <> requested_by)
  )
);
CREATE INDEX IF NOT EXISTS gaiz_import_authorizations_tenant_pending_idx
 ON public.gaiz_import_authorizations (tenant_id,status,requested_at DESC);
ALTER TABLE public.gaiz_import_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaiz_import_authorizations FORCE ROW LEVEL SECURITY;
CREATE POLICY gaiz_import_authorizations_tenant_only ON public.gaiz_import_authorizations
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
-- Production gates: apply only after isolated tenant-RLS and role-grant review.
),
  requested_by uuid NOT NULL REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+ interval '30 minutes'),
  reviewed_at timestamptz,
  CONSTRAINT gaiz_import_authorization_review_fk FOREIGN KEY (tenant_id,staging_review_id)
    REFERENCES public.gaiz_import_requests(tenant_id,id) ON DELETE CASCADE,
  -- Composite FK prevents a same-tenant custody attempt from being rebound
  -- to an unrelated GAIZ staging review.
  CONSTRAINT gaiz_import_authorization_custody_fk
    FOREIGN KEY (tenant_id,staging_review_id,custody_attempt_id)
    REFERENCES public.gaiz_custody_attempts(tenant_id,review_id,id) ON DELETE CASCADE,
  CONSTRAINT gaiz_import_authorization_review_once UNIQUE(tenant_id,staging_review_id),
  CONSTRAINT gaiz_import_authorization_state CHECK (
    (status='pending' AND approved_by IS NULL AND reviewed_at IS NULL)
    OR (status IN ('approved','rejected') AND approved_by IS NOT NULL
      AND reviewed_at IS NOT NULL AND approved_by <> requested_by)
  )
);
CREATE INDEX IF NOT EXISTS gaiz_import_authorizations_tenant_pending_idx
 ON public.gaiz_import_authorizations (tenant_id,status,requested_at DESC);
ALTER TABLE public.gaiz_import_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaiz_import_authorizations FORCE ROW LEVEL SECURITY;
CREATE POLICY gaiz_import_authorizations_tenant_only ON public.gaiz_import_authorizations
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
-- Production gates: apply only after isolated tenant-RLS and role-grant review.
