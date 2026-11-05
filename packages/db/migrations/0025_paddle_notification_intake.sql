-- Additive Paddle notification routing and append-only reversal review.
-- Do not change historical Stripe rows or activate subscriptions.
-- Restrict cross-tenant lookup to an unpredictable Paddle transaction ID.
CREATE OR REPLACE FUNCTION public.pmo_paddle_tenant_for_transaction(p_transaction_id text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT tenant_id
  FROM public.billing_paddle_checkout_intents
  WHERE paddle_transaction_id = p_transaction_id
    AND p_transaction_id ~ '^txn_[a-z0-9]{26}$'
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.pmo_paddle_tenant_for_transaction(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pmo_paddle_tenant_for_transaction(text) TO pmo_app;

-- Required for the composite FK; existing settlement table already has UUID PK.
ALTER TABLE public.billing_paddle_settlements
  ADD CONSTRAINT billing_paddle_settlements_tenant_id_id_unique UNIQUE (tenant_id,id);

CREATE TABLE public.billing_paddle_adjustment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  settlement_id uuid NOT NULL,
  paddle_event_id text NOT NULL UNIQUE CHECK (paddle_event_id ~ '^evt_[a-z0-9]{26}$'),
  paddle_adjustment_id text NOT NULL CHECK (paddle_adjustment_id ~ '^adj_[a-z0-9]{26}$'),
  paddle_transaction_id text NOT NULL CHECK (paddle_transaction_id ~ '^txn_[a-z0-9]{26}$'),
  event_type text NOT NULL CHECK (event_type IN ('adjustment.created','adjustment.updated')),
  action text NOT NULL CHECK (action IN
    ('refund','credit','chargeback','chargeback_warning','chargeback_reverse',
     'chargeback_warning_reverse','credit_reverse')),
  adjustment_status text NOT NULL CHECK (adjustment_status IN
    ('pending_approval','approved','rejected','reversed')),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paddle_adjustment_settlement_fk FOREIGN KEY (settlement_id)
    REFERENCES public.billing_paddle_settlements(id),
  CONSTRAINT paddle_adjustment_settlement_tenant_fk FOREIGN KEY (tenant_id,settlement_id)
    REFERENCES public.billing_paddle_settlements(tenant_id,id)
);
CREATE INDEX billing_paddle_adjustments_tenant_idx
  ON public.billing_paddle_adjustment_receipts(tenant_id,settlement_id,received_at DESC);
ALTER TABLE public.billing_paddle_adjustment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_paddle_adjustment_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY paddle_adjustment_receipt_tenant_policy ON public.billing_paddle_adjustment_receipts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
