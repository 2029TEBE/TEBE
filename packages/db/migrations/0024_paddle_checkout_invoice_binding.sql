-- P0 additive invoice binding. Historical Paddle and Stripe migration bytes stay immutable.
-- An intent without a server-owned invoice reference is deliberately ineligible
-- for a settlement writer. Keep nullable to avoid rewriting historical rows.
ALTER TABLE public.billing_paddle_checkout_intents
  ADD COLUMN invoice_id uuid;
ALTER TABLE public.billing_paddle_checkout_intents
  ADD CONSTRAINT billing_paddle_checkout_invoice_fk
  FOREIGN KEY (tenant_id, invoice_id)
  REFERENCES public.billing_invoices(tenant_id, id);
CREATE INDEX billing_paddle_checkout_invoice_tenant_idx
  ON public.billing_paddle_checkout_intents(tenant_id, invoice_id)
  WHERE invoice_id IS NOT NULL;
