-- THE EPMO Evaluation: one seven-day, nonrenewing, card-free trial per tenant.
-- The global plan carries no payable price and has no Paddle integration.
INSERT INTO public.subscription_plans
  (code, name, price_minor, currency, billing_interval, trial_days, is_active)
VALUES ('evaluation_7day', 'THE EPMO Evaluation', 0, 'SAR', 'monthly', 7, true)
ON CONFLICT (code) DO NOTHING;

-- Immutable evidence of the first activation; deleting/restarting an expired
-- subscription must never permit another free trial for the same workspace.
CREATE TABLE public.tenant_evaluation_trials (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE RESTRICT,
  subscription_id uuid NOT NULL UNIQUE,
  started_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT evaluation_exact_168_hours CHECK (expires_at = started_at + interval '168 hours'),
  CONSTRAINT evaluation_tenant_subscription_fk FOREIGN KEY (tenant_id, subscription_id)
    REFERENCES public.tenant_subscriptions (tenant_id, id)
    ON DELETE RESTRICT
);
CREATE INDEX tenant_evaluation_trials_expiry_idx
  ON public.tenant_evaluation_trials(expires_at);
ALTER TABLE public.tenant_evaluation_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_evaluation_trials FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_evaluation_trials_isolation ON public.tenant_evaluation_trials
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
-- The app may insert one record but cannot update/delete trial history.
REVOKE UPDATE, DELETE ON public.tenant_evaluation_trials FROM pmo_app;
