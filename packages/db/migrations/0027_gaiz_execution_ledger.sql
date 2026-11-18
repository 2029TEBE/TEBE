-- Dedicated execution ledger. No private keys or decrypted report fields.
-- Draft, not applied to any existing database by this change.
CREATE TABLE public.gaiz_execution_grants (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 authorization_id uuid NOT NULL REFERENCES public.gaiz_import_authorizations(id),
 grant_sha256 text NOT NULL CHECK (grant_sha256 ~ '^[a-f0-9]{64}$'),
 envelope jsonb NOT NULL,
 expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'issued' CHECK (state IN ('issued','consumed','revoked')),
 consumed_at timestamptz,
 result_sha256 text CHECK (result_sha256 IS NULL OR result_sha256 ~ '^[a-f0-9]{64}$'),
 CONSTRAINT gaiz_execution_grants_tenant_authorization_unique UNIQUE (tenant_id,authorization_id),
 CHECK ((state='consumed' AND consumed_at IS NOT NULL AND result_sha256 IS NOT NULL)
   OR (state IN ('issued','revoked') AND consumed_at IS NULL AND result_sha256 IS NULL))
);
ALTER TABLE public.gaiz_execution_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaiz_execution_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY gaiz_execution_grants_tenant_only ON public.gaiz_execution_grants
 USING (tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
-- Composite foreign key prevents rebinding an execution grant across tenants.
ALTER TABLE public.gaiz_import_authorizations ADD CONSTRAINT gaiz_import_auth_tenant_id UNIQUE(tenant_id,id);
ALTER TABLE public.gaiz_execution_grants ADD CONSTRAINT gaiz_execution_auth_tenant_fk
 FOREIGN KEY(tenant_id,authorization_id) REFERENCES public.gaiz_import_authorizations(tenant_id,id);
REVOKE ALL ON public.gaiz_execution_grants FROM PUBLIC;

-- Read-only application roles need row locks, not permission to modify trust.
-- Fixed SECURITY DEFINER SQL; exact tenant is checked inside each function,
-- including when the administrative function owner can bypass RLS. No dynamic SQL.
CREATE FUNCTION public.gaiz_lock_trust_key(p_tenant uuid,p_kind text,p_key text)
 RETURNS SETOF public.gaiz_trust_keys
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT k.* FROM public.gaiz_trust_keys k
 WHERE k.tenant_id=p_tenant AND k.key_kind=p_kind AND k.key_id=p_key
 AND p_tenant=NULLIF(current_setting('app.tenant_id',true),'')::uuid FOR SHARE;
$$;
CREATE FUNCTION public.gaiz_lock_recovery_consent(p_tenant uuid,p_key text,p_now timestamptz)
 RETURNS SETOF public.gaiz_recovery_consents
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT c.* FROM public.gaiz_recovery_consents c
 WHERE c.tenant_id=p_tenant AND c.recipient_key_id=p_key
 AND p_tenant=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND c.status='approved' AND c.purpose='approved-field-import'
 AND c.revoked_at IS NULL AND c.expires_at>p_now FOR SHARE;
$$;
REVOKE ALL ON FUNCTION public.gaiz_lock_trust_key(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gaiz_lock_recovery_consent(uuid,text,timestamptz) FROM PUBLIC;

-- Metadata-only recovery consent never authorizes a plaintext field import.
ALTER TABLE public.gaiz_recovery_consents DROP CONSTRAINT gaiz_recovery_consents_purpose_check;
ALTER TABLE public.gaiz_recovery_consents ADD CONSTRAINT gaiz_recovery_consents_purpose_check
 CHECK(purpose IN ('custodian-validation-only','approved-field-import'));
