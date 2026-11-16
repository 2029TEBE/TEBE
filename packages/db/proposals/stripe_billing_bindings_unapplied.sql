-- DESIGN PROPOSAL ONLY — DO NOT APPLY. Not in Drizzle migration journal.
-- Must be renumbered AFTER GAIZ branch migrations 0020–0026 are integrated.
-- Stripe billing customer, approved price, subscription and replay bindings.
-- This intentionally does NOT alter tenant_subscriptions, entitlements,
-- legacy Stripe invoice tables, or settled historical payment references.
-- All writes must be performed by a separately secured billing worker after
-- independently verifying Stripe evidence, not by pmo_app or browser input.

CREATE TABLE public.stripe_billing_customer_bindings (
  tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL CHECK (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  livemode boolean NOT NULL,
  stripe_customer_id text NOT NULL CHECK (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_billing_customer_unique UNIQUE (stripe_account_id,livemode,stripe_customer_id),
  CONSTRAINT stripe_billing_customer_composite UNIQUE (tenant_id,stripe_account_id,livemode,stripe_customer_id)
);

-- Administrative approval records: NOT writable by pmo_app.
-- Platform-approved catalog only, bound to one Stripe account and mode.
CREATE TABLE public.stripe_billing_approved_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_account_id text NOT NULL CHECK (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  livemode boolean NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  catalogue_revision integer NOT NULL CHECK (catalogue_revision > 0),
  stripe_price_id text NOT NULL CHECK (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  recurring_interval text NOT NULL CHECK (recurring_interval IN ('month','year')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  requested_by uuid NOT NULL REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_price_reviewer_independence CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL
     AND approved_by <> requested_by)
    OR (status <> 'approved' AND approved_by IS NULL AND approved_at IS NULL)
  ),
  CONSTRAINT stripe_price_binding_unique UNIQUE (
    stripe_account_id,livemode,plan_id,catalogue_revision,stripe_price_id
  ),
  CONSTRAINT stripe_price_external_unique UNIQUE (stripe_account_id,livemode,stripe_price_id)
);

CREATE TABLE public.stripe_billing_subscription_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL,
  livemode boolean NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL CHECK (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  stripe_checkout_session_id text NOT NULL CHECK (
    stripe_checkout_session_id ~ '^cs_(test_|live_)[A-Za-z0-9]+$'
  ),
  plan_id uuid NOT NULL,
  catalogue_revision integer NOT NULL,
  stripe_price_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending_verification' CHECK (
    status IN ('pending_verification','verified','canceled','suspended')
  ),
  last_verified_invoice_id text CHECK (
    last_verified_invoice_id IS NULL OR last_verified_invoice_id ~ '^in_[A-Za-z0-9]+$'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  CONSTRAINT stripe_binding_customer_fk FOREIGN KEY (
    tenant_id,stripe_account_id,livemode,stripe_customer_id
  ) REFERENCES public.stripe_billing_customer_bindings(
    tenant_id,stripe_account_id,livemode,stripe_customer_id
  ),
  CONSTRAINT stripe_binding_approved_price_fk FOREIGN KEY (
    stripe_account_id,livemode,plan_id,catalogue_revision,stripe_price_id
  ) REFERENCES public.stripe_billing_approved_prices(
    stripe_account_id,livemode,plan_id,catalogue_revision,stripe_price_id
  ),
  CONSTRAINT stripe_binding_subscription_unique UNIQUE (
    stripe_account_id,livemode,stripe_subscription_id
  ),
  CONSTRAINT stripe_binding_checkout_unique UNIQUE (
    stripe_account_id,livemode,stripe_checkout_session_id
  ),
  CONSTRAINT stripe_binding_tenant_id_unique UNIQUE (tenant_id,id),
  CONSTRAINT stripe_binding_status_review CHECK (
    (status <> 'verified' OR verified_at IS NOT NULL)
  )
);
CREATE INDEX stripe_subscription_tenant_idx ON
  public.stripe_billing_subscription_bindings (tenant_id,created_at DESC);

-- Durable event-id replay ledger. Insert only in the same transaction that
-- records a verified financial outcome. Do not acknowledge failed processing
-- as 'applied' and do not fabricate tenant ownership from webhook metadata.
CREATE TABLE public.stripe_billing_event_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  binding_id uuid NOT NULL,
  stripe_account_id text NOT NULL CHECK (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  livemode boolean NOT NULL,
  stripe_event_id text NOT NULL CHECK (stripe_event_id ~ '^evt_[A-Za-z0-9]+$'),
  stripe_invoice_id text CHECK (
    stripe_invoice_id IS NULL OR stripe_invoice_id ~ '^in_[A-Za-z0-9]+$'
  ),
  event_type text NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  processing_status text NOT NULL DEFAULT 'received' CHECK (
    processing_status IN ('received','applied','ignored','needs_review')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_event_binding_fk FOREIGN KEY (tenant_id,binding_id)
    REFERENCES public.stripe_billing_subscription_bindings(tenant_id,id),
  CONSTRAINT stripe_event_exactly_once UNIQUE (stripe_account_id,livemode,stripe_event_id)
);
CREATE INDEX stripe_event_tenant_created_idx ON
  public.stripe_billing_event_receipts (tenant_id,created_at DESC);

-- RLS on all tenant-scoped tables. Prices are vendor-global and have no
-- tenant_id; administrative price approvals must never be written by pmo_app.
ALTER TABLE public.stripe_billing_customer_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_billing_customer_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY stripe_customer_tenant_read ON public.stripe_billing_customer_bindings
  FOR SELECT USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE public.stripe_billing_subscription_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_billing_subscription_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY stripe_subscription_tenant_read ON public.stripe_billing_subscription_bindings
  FOR SELECT USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE public.stripe_billing_event_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_billing_event_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY stripe_event_tenant_read ON public.stripe_billing_event_receipts
  FOR SELECT USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);

-- This must be applied AFTER the broad grants in packages/db/sql/rls.sql.
-- Separate migrations need audited owner/admin DDL privileges; pmo_app must
-- never be allowed to set customer/price/subscription bindings or event state.
REVOKE ALL ON public.stripe_billing_approved_prices FROM PUBLIC;
REVOKE ALL ON public.stripe_billing_customer_bindings,
  public.stripe_billing_subscription_bindings,
  public.stripe_billing_event_receipts FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.stripe_billing_approved_prices,
  public.stripe_billing_customer_bindings,
  public.stripe_billing_subscription_bindings,
  public.stripe_billing_event_receipts FROM pmo_app;
GRANT SELECT ON public.stripe_billing_approved_prices,
  public.stripe_billing_customer_bindings,
  public.stripe_billing_subscription_bindings,
  public.stripe_billing_event_receipts TO pmo_app;
