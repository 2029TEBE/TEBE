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
-- Fixtures are seeded by the disposable database superuser.
INSERT INTO public.ao_task_reservations
 (tenant_id,request_hash,request_digest,principal_id,tool_id,task_id)
VALUES
 ('11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('1',64),'principal-a','ao.read','taskid1234567890'),
 ('22222222-2222-4222-8222-222222222222',repeat('b',64),repeat('2',64),'principal-b','ao.read','taskid1234567891');
