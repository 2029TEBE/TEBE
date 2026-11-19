\set ON_ERROR_STOP on
-- Disposable PostgreSQL 16 AO reservation proof ONLY. Not a product migration.
DO $$ BEGIN
 IF current_database()<>'ao_ci_isolated'
    OR to_regclass('public.ao_task_reservations') IS NOT NULL
 THEN RAISE EXCEPTION 'AO fixture requires new ao_ci_isolated database'; END IF;
END $$;
CREATE ROLE ao_ci_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE TABLE public.ao_task_reservations (
 tenant_id uuid NOT NULL,
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 principal_id text NOT NULL CHECK(principal_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
 tool_id text NOT NULL CHECK(tool_id ~ '^[a-z][a-z0-9_.-]{2,79}$'),
 task_id text NOT NULL CHECK(task_id ~ '^[A-Za-z0-9_-]{16,128}$'),
 state text NOT NULL DEFAULT 'pending_review' CHECK(state='pending_review'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ao_task_reservation_unique_request PRIMARY KEY (tenant_id,request_hash)
);
CREATE OR REPLACE FUNCTION ao_ci_current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $sql$
 SELECT NULLIF(current_setting('app.tenant_id',true),'')::uuid;
$sql$;
ALTER TABLE public.ao_task_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_task_reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY ao_ci_isolation ON public.ao_task_reservations
 USING (tenant_id=ao_ci_current_tenant())
 WITH CHECK (tenant_id=ao_ci_current_tenant());
REVOKE ALL ON TABLE public.ao_task_reservations FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ao_ci_app;
GRANT SELECT,INSERT ON TABLE public.ao_task_reservations TO ao_ci_app;

-- Disposable adapter-only LOGIN principal. No production role is created.
-- This role inherits ONLY the restricted fixture grants; no BYPASSRLS/admin.
CREATE ROLE ao_ci_client LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
 NOREPLICATION NOBYPASSRLS PASSWORD 'ao_local_test_only_adapter_2026';
GRANT ao_ci_app TO ao_ci_client;
-- Server-owned synthetic entitlement store. No write access from the app role.
CREATE TABLE public.ao_ci_actor_rights (
 tenant_id uuid NOT NULL,
 principal_id text NOT NULL,
 tool_id text NOT NULL,
 active boolean NOT NULL,
 entitled boolean NOT NULL,
 risk text NOT NULL CHECK(risk IN ('read','privileged')),
 transport text NOT NULL CHECK(transport IN ('tebe_api','native')),
 PRIMARY KEY(tenant_id,principal_id,tool_id)
);
ALTER TABLE public.ao_ci_actor_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_ci_actor_rights FORCE ROW LEVEL SECURITY;
CREATE POLICY ao_ci_actor_isolation ON public.ao_ci_actor_rights
 USING (tenant_id=ao_ci_current_tenant())
 WITH CHECK (tenant_id=ao_ci_current_tenant());
REVOKE ALL ON public.ao_ci_actor_rights FROM PUBLIC;
GRANT SELECT ON public.ao_ci_actor_rights TO ao_ci_app;
INSERT INTO public.ao_ci_actor_rights
 (tenant_id,principal_id,tool_id,active,entitled,risk,transport)
VALUES
 ('11111111-1111-4111-8111-111111111111','principal-a','ao.read',true,true,'read','tebe_api'),
 ('22222222-2222-4222-8222-222222222222','principal-b','ao.read',true,true,'read','tebe_api'),
 ('11111111-1111-4111-8111-111111111111','disabled-a','ao.read',false,false,'read','tebe_api'),
 ('11111111-1111-4111-8111-111111111111','privileged-a','ao.exec',true,true,'privileged','native');

-- Fixtures are seeded by the disposable database superuser.
INSERT INTO public.ao_task_reservations
 (tenant_id,request_hash,request_digest,principal_id,tool_id,task_id)
VALUES
 ('11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('1',64),'principal-a','ao.read','taskid1234567890'),
 ('22222222-2222-4222-8222-222222222222',repeat('b',64),repeat('2',64),'principal-b','ao.read','taskid1234567891');
