-- Additive append-only pre-network Paddle checkout attempt journal.
-- A committed reservation precedes ANY remote POST /transactions.
-- One reservation per invoice: ambiguous provider results MUST be reconciled,
-- never retried by creating a second Paddle transaction.
CREATE TABLE public.billing_paddle_checkout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  invoice_id uuid NOT NULL,
  subscription_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  paddle_price_id text NOT NULL CHECK (paddle_price_id ~ '^pri_[a-z0-9]{26}$'),
  environment text NOT NULL CHECK (environment = 'sandbox'),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paddle_attempt_invoice_fk FOREIGN KEY (tenant_id,invoice_id)
    REFERENCES public.billing_invoices(tenant_id,id),
  CONSTRAINT paddle_attempt_subscription_fk FOREIGN KEY (tenant_id,subscription_id)
    REFERENCES public.tenant_subscriptions(tenant_id,id),
  CONSTRAINT paddle_attempt_one_per_invoice UNIQUE (invoice_id),
  CONSTRAINT paddle_attempt_tenant_id_unique UNIQUE (tenant_id,id)
);
CREATE INDEX paddle_attempt_tenant_lookup_idx
  ON public.billing_paddle_checkout_attempts(tenant_id,subscription_id,created_at DESC);
ALTER TABLE public.billing_paddle_checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_paddle_checkout_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY paddle_attempt_tenant_policy
  ON public.billing_paddle_checkout_attempts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);

-- Preserve immutable historical checkout rows. A provider transaction may
-- optionally bind to an earlier attempt after successful provider validation.
ALTER TABLE public.billing_paddle_checkout_intents
  ADD COLUMN attempt_id uuid;
ALTER TABLE public.billing_paddle_checkout_intents
  ADD CONSTRAINT paddle_checkout_attempt_fk FOREIGN KEY (tenant_id,attempt_id)
  REFERENCES public.billing_paddle_checkout_attempts(tenant_id,id);
CREATE UNIQUE INDEX paddle_checkout_attempt_unique_idx
  ON public.billing_paddle_checkout_intents(attempt_id)
  WHERE attempt_id IS NOT NULL;
