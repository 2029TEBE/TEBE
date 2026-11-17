-- Append-only revocation of one-time approval-seat delegations.
-- Existing receipts remain immutable; legacy delegations have no expiry.
ALTER TABLE public.studio_approval_delegations
 ADD COLUMN expires_at timestamptz;
ALTER TABLE public.studio_approval_delegations
 ADD CONSTRAINT studio_delegation_expiry_after_creation
 CHECK (expires_at IS NULL OR expires_at > created_at);

CREATE TABLE public.studio_approval_delegation_revocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 delegation_id uuid NOT NULL REFERENCES public.studio_approval_delegations(id),
 request_id uuid NOT NULL,
 revoked_by uuid NOT NULL REFERENCES public.users(id),
 reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,delegation_id),
 FOREIGN KEY (tenant_id,request_id) REFERENCES public.studio_service_requests(tenant_id,id)
);
CREATE INDEX studio_delegation_revocations_request
 ON public.studio_approval_delegation_revocations(tenant_id,request_id,created_at DESC);
ALTER TABLE public.studio_approval_delegation_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_approval_delegation_revocations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.studio_approval_delegation_revocations
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON public.studio_approval_delegation_revocations FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pmo_app') THEN
  GRANT SELECT,INSERT ON public.studio_approval_delegation_revocations TO pmo_app;
  REVOKE UPDATE,DELETE ON public.studio_approval_delegation_revocations FROM pmo_app;
 END IF;
END $$;
