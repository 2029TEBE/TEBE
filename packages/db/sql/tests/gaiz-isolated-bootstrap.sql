\set ON_ERROR_STOP on
-- Disposable database fixtures only. Never run on an existing workspace.
DO $$ BEGIN
  IF current_database() <> 'gaiz_ci_isolated'
     OR to_regclass('public.projects') IS NOT NULL
     OR to_regclass('public.gaiz_import_requests') IS NOT NULL THEN
    RAISE EXCEPTION 'GAIZ fixtures require a fresh gaiz_ci_isolated database';
  END IF;
END $$;
CREATE TABLE public.tenants (id uuid PRIMARY KEY);
CREATE TABLE public.users (id uuid PRIMARY KEY);
CREATE TABLE public.projects (id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),name text NOT NULL);
CREATE TABLE public.portfolios (id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),name text NOT NULL,description text);
INSERT INTO public.tenants VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.users VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO public.projects VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Synthetic project');
INSERT INTO public.portfolios VALUES
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Synthetic portfolio','Synthetic summary');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pmo_app') THEN
  CREATE ROLE pmo_app NOLOGIN;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO pmo_app;
