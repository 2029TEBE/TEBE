-- 0027: email-verified signup for an empty EPMO tenant, not a paid or trial grant.
-- All public-account/tenant writes take place inside restricted SECURITY DEFINER functions.
CREATE TABLE public.signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  workspace_name text NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT signup_request_ttl CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes'),
  CONSTRAINT signup_email_lower CHECK (email=lower(email) AND length(email) <= 254)
);
CREATE INDEX signup_requests_email_created_idx ON public.signup_requests(email,created_at DESC);
CREATE INDEX signup_requests_expiry_idx ON public.signup_requests(expires_at);
REVOKE ALL ON public.signup_requests FROM PUBLIC;
REVOKE ALL ON public.signup_requests FROM pmo_app;

CREATE FUNCTION public.pmo_issue_signup_request(
  p_email text, p_display_name text, p_workspace_name text, p_token_hash text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $signup_issue$
BEGIN
  IF p_email IS NULL OR p_email<>lower(btrim(p_email)) OR length(p_email)>254 OR
     p_email !~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$' OR
     p_display_name IS NULL OR length(btrim(p_display_name)) NOT BETWEEN 2 AND 120 OR
     p_workspace_name IS NULL OR length(btrim(p_workspace_name)) NOT BETWEEN 2 AND 120 OR
     p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  -- Email, not a caller-selected workspace slug, is the concurrency/cooldown key.
  PERFORM pg_advisory_xact_lock(7301, hashtext(p_email));
  IF EXISTS(SELECT 1 FROM public.users WHERE lower(email)=p_email) OR
     EXISTS(SELECT 1 FROM public.signup_requests
             WHERE email=p_email AND created_at>now()-interval '15 minutes') THEN
    RETURN false;
  END IF;
  INSERT INTO public.signup_requests(email,display_name,workspace_name,token_hash,expires_at)
  VALUES(p_email,btrim(p_display_name),btrim(p_workspace_name),
         p_token_hash,now()+interval '30 minutes');
  RETURN true;
END;
$signup_issue$;

CREATE FUNCTION public.pmo_revoke_signup_request(p_token_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $signup_revoke$
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
  UPDATE public.signup_requests SET revoked_at=now()
    WHERE token_hash=p_token_hash AND consumed_at IS NULL AND revoked_at IS NULL;
END;
$signup_revoke$;

CREATE FUNCTION public.pmo_complete_signup_request(p_token_hash text, p_password_hash text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $signup_confirm$
DECLARE
  requested public.signup_requests%ROWTYPE;
  created_user uuid;
  created_tenant uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' OR
     p_password_hash IS NULL OR p_password_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' THEN
    RETURN false;
  END IF;
  SELECT * INTO requested FROM public.signup_requests
  WHERE token_hash=p_token_hash FOR UPDATE;
  IF NOT FOUND OR requested.consumed_at IS NOT NULL OR
     requested.revoked_at IS NOT NULL OR requested.expires_at<=now() THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(7301,hashtext(requested.email));
  IF EXISTS(SELECT 1 FROM public.users WHERE lower(email)=requested.email) THEN RETURN false; END IF;
  INSERT INTO public.users(email,display_name,password_hash)
    VALUES(requested.email,requested.display_name,p_password_hash)
    ON CONFLICT(email) DO NOTHING RETURNING id INTO created_user;
  IF created_user IS NULL THEN RETURN false; END IF;
  -- Do not accept a caller-supplied tenant id or slug. Random slug prevents
  -- enumeration and collisions with existing tenants.
  INSERT INTO public.tenants(name,slug)
    VALUES(requested.workspace_name,'workspace-'||replace(gen_random_uuid()::text,'-',''))
    RETURNING id INTO created_tenant;
  INSERT INTO public.memberships(tenant_id,user_id,role)
    VALUES(created_tenant,created_user,'owner'::public.member_role);
  UPDATE public.signup_requests SET consumed_at=now() WHERE id=requested.id;
  INSERT INTO public.auth_events(user_id,action,detail)
    VALUES(created_user,'signup.email_verified','new_empty_workspace');
  INSERT INTO public.audit_events(tenant_id,actor_id,entity,entity_id,action,diff)
    VALUES(created_tenant,created_user,'tenant',created_tenant,'signup.email_verified',
      '{"verified":true,"paid":false,"trialStarted":false}'::jsonb);
  RETURN true;
END;
$signup_confirm$;

-- PostgreSQL functions default to PUBLIC EXECUTE: explicitly seal all three.
REVOKE ALL ON FUNCTION public.pmo_issue_signup_request(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pmo_revoke_signup_request(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pmo_complete_signup_request(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pmo_issue_signup_request(text,text,text,text) TO pmo_app;
GRANT EXECUTE ON FUNCTION public.pmo_revoke_signup_request(text) TO pmo_app;
GRANT EXECUTE ON FUNCTION public.pmo_complete_signup_request(text,text) TO pmo_app;
