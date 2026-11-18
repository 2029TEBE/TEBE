-- GAIZ2 tenant-scoped PUBLIC trust metadata only (draft, unapplied).
-- NEVER store private keys, passphrases, data-encryption keys or plaintext here.
CREATE TABLE public.gaiz_trust_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key_id text NOT NULL CHECK (key_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  key_kind text NOT NULL CHECK (key_kind IN ('issuer','custodian','recipient')),
  algorithm text NOT NULL CHECK (
    (key_kind IN ('issuer','custodian') AND algorithm='Ed25519')
    OR (key_kind='recipient' AND algorithm='RSA-OAEP-SHA256')
  ),
  owner_type text NOT NULL CHECK (owner_type IN ('customer','platform')),
  public_key_pem text NOT NULL CHECK (length(public_key_pem) BETWEEN 80 AND 4096),
  public_key_sha256 text NOT NULL CHECK (public_key_sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  registered_by uuid NOT NULL REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  approved_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT gaiz_trust_key_scope UNIQUE (tenant_id,key_kind,key_id),
  CONSTRAINT gaiz_trust_valid_window CHECK (valid_until>valid_from),
  CONSTRAINT gaiz_trust_lifecycle CHECK (
    (status='pending' AND approved_by IS NULL AND approved_at IS NULL AND revoked_at IS NULL)
    OR (status='active' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND
        approved_by<>registered_by AND revoked_at IS NULL)
    OR (status='revoked' AND revoked_at IS NOT NULL)
  )
);
CREATE INDEX gaiz_trust_keys_tenant_kind_status_idx
  ON public.gaiz_trust_keys (tenant_id,key_kind,status);
ALTER TABLE public.gaiz_trust_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaiz_trust_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY gaiz_trust_keys_tenant_only ON public.gaiz_trust_keys
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);

-- An explicit customer-approved consent is needed for PLATFORM-owned recipients.
CREATE TABLE public.gaiz_recovery_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  consent_id text NOT NULL CHECK (consent_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  recipient_key_id text NOT NULL,
  key_kind text NOT NULL DEFAULT 'recipient' CHECK (key_kind='recipient'),
  purpose text NOT NULL CHECK (purpose='custodian-validation-only'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  requested_by uuid NOT NULL REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  approved_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT gaiz_recovery_consent_scope UNIQUE (tenant_id,consent_id),
  CONSTRAINT gaiz_recovery_consent_recipient_fk FOREIGN KEY (tenant_id,key_kind,recipient_key_id)
    REFERENCES public.gaiz_trust_keys (tenant_id,key_kind,key_id),
  CONSTRAINT gaiz_recovery_consent_state CHECK (
    (status='pending' AND approved_by IS NULL AND approved_at IS NULL AND revoked_at IS NULL)
    OR (status='approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL
      AND approved_by<>requested_by AND revoked_at IS NULL)
    OR (status='revoked' AND revoked_at IS NOT NULL)
  )
);
CREATE INDEX gaiz_recovery_consents_tenant_status_idx
 ON public.gaiz_recovery_consents (tenant_id,status,recipient_key_id);
ALTER TABLE public.gaiz_recovery_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaiz_recovery_consents FORCE ROW LEVEL SECURITY;
CREATE POLICY gaiz_recovery_consents_tenant_only ON public.gaiz_recovery_consents
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
