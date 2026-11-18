-- Governed Studio v1: inert tenant-scoped definitions, requests, decisions and evidence.
-- No imported execution step can activate from these metadata tables.
CREATE TABLE public.studio_service_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 service_key text NOT NULL CHECK (service_key ~ '^[a-z][a-z0-9_-]{2,79}$'),
 version integer NOT NULL CHECK (version > 0),
 state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','in_review','approved','published','retired')),
 definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
 content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_sha256 text CHECK (reviewed_sha256 IS NULL OR reviewed_sha256 ~ '^[a-f0-9]{64}$'),
 created_by uuid NOT NULL REFERENCES public.users(id),
 reviewed_by uuid REFERENCES public.users(id),
 published_by uuid REFERENCES public.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 published_at timestamptz,
 UNIQUE (tenant_id,service_key,version),
 UNIQUE (tenant_id,id),
 CHECK (reviewed_by IS NULL OR reviewed_by <> created_by),
 CHECK (published_by IS NULL OR (published_by <> created_by AND published_by <> reviewed_by)),
 CHECK (state NOT IN ('approved','published','retired') OR
        (reviewed_by IS NOT NULL AND reviewed_sha256 = content_sha256)),
 CHECK (state NOT IN ('published','retired') OR published_by IS NOT NULL)
);
-- One live public-to-tenant version at a time. All draft versions remain private.
CREATE UNIQUE INDEX studio_service_one_published_version
 ON public.studio_service_versions(tenant_id,service_key) WHERE state = 'published';
CREATE INDEX studio_service_versions_tenant_state ON public.studio_service_versions(tenant_id,state,service_key);
CREATE TABLE public.studio_service_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 service_version_id uuid NOT NULL,
 form_version integer NOT NULL CHECK(form_version > 0),
 workflow_version integer NOT NULL CHECK(workflow_version > 0),
 definition_sha256 text NOT NULL CHECK (definition_sha256 ~ '^[a-f0-9]{64}$'),
 requester_id uuid NOT NULL REFERENCES public.users(id),
 phase text NOT NULL DEFAULT 'manager' CHECK (phase IN ('manager','finance','fulfillment','rejected','completed','cancelled')),
 submitted_values jsonb NOT NULL CHECK(jsonb_typeof(submitted_values) = 'object'),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,id),
 FOREIGN KEY(tenant_id,service_version_id) REFERENCES public.studio_service_versions(tenant_id,id)
);
CREATE INDEX studio_service_requests_tenant_user ON public.studio_service_requests(tenant_id,requester_id,submitted_at DESC);
CREATE TABLE public.studio_service_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 step_key text NOT NULL CHECK(length(step_key) BETWEEN 1 AND 80),
 principal_id uuid NOT NULL REFERENCES public.users(id),
 decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 decided_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,request_id,step_key,principal_id),
 FOREIGN KEY(tenant_id,request_id) REFERENCES public.studio_service_requests(tenant_id,id)
);
CREATE TABLE public.studio_service_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 operator_id uuid NOT NULL REFERENCES public.users(id),
 artifact_reference text NOT NULL CHECK(length(artifact_reference) BETWEEN 1 AND 512),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,request_id) REFERENCES public.studio_service_requests(tenant_id,id)
);
-- Defense in depth: fail closed on all four tables without a tenant context.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['studio_service_versions','studio_service_requests','studio_service_decisions','studio_service_evidence']
 LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON public.%I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
-- The application must not be able to delete historical approvals or evidence.
REVOKE ALL ON public.studio_service_versions,public.studio_service_requests,public.studio_service_decisions,public.studio_service_evidence FROM PUBLIC;
