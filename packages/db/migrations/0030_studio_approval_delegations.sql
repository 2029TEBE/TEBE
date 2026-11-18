-- Explicit, one-time, non-revocable reassignment of an individual active
-- approval seat. Immutable receipts preserve historical reviewer identity.
-- Never changes approval decisions or executes overdue timeout actions.
CREATE TABLE public.studio_approval_delegations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 step_key text NOT NULL CHECK (step_key IN ('manager','finance')),
 original_approver_id uuid NOT NULL REFERENCES public.users(id),
 delegate_id uuid NOT NULL REFERENCES public.users(id),
 delegated_by uuid NOT NULL REFERENCES public.users(id),
 reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (original_approver_id <> delegate_id),
 CHECK (delegated_by <> delegate_id),
 UNIQUE (tenant_id,request_id,step_key,original_approver_id),
 UNIQUE (tenant_id,request_id,step_key,delegate_id),
 FOREIGN KEY (tenant_id,request_id)
   REFERENCES public.studio_service_requests(tenant_id,id)
);
CREATE INDEX studio_approval_delegations_request
 ON public.studio_approval_delegations(tenant_id,request_id,step_key);
ALTER TABLE public.studio_approval_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_approval_delegations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.studio_approval_delegations
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON public.studio_approval_delegations FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pmo_app') THEN
  GRANT SELECT,INSERT ON public.studio_approval_delegations TO pmo_app;
  REVOKE UPDATE,DELETE ON public.studio_approval_delegations FROM pmo_app;
 END IF;
END $$;
