-- Append-only, tenant-scoped Studio escalation review receipts.
-- A review record is NOT an approval, delegation or automatic escalation.
CREATE TABLE public.studio_escalation_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 step_key text NOT NULL CHECK(step_key IN ('manager','finance')),
 reviewed_by uuid NOT NULL REFERENCES public.users(id),
 action text NOT NULL CHECK(action IN ('acknowledged','contacted_owner','referred_to_governance')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 1000),
 phase_started_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id,request_id) REFERENCES public.studio_service_requests(tenant_id,id)
);
CREATE INDEX studio_escalation_reviews_lookup
 ON public.studio_escalation_reviews(tenant_id,request_id,step_key,created_at DESC);
ALTER TABLE public.studio_escalation_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_escalation_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.studio_escalation_reviews
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON public.studio_escalation_reviews FROM PUBLIC;
-- Explicitly append-only even after the general pmo_app grants are applied.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pmo_app') THEN
  GRANT SELECT,INSERT ON public.studio_escalation_reviews TO pmo_app;
  REVOKE UPDATE,DELETE ON public.studio_escalation_reviews FROM pmo_app;
 END IF;
END $$;
