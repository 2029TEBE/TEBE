-- Forward-looking Paddle ledger, with no Stripe backfill or delete.
-- Schema only; a verified checkout/webhook worker is NOT implemented yet.
CREATE TABLE billing_paddle_checkout_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 subscription_id uuid NOT NULL,
 plan_id uuid NOT NULL REFERENCES subscription_plans(id),
 paddle_transaction_id text NOT NULL UNIQUE CHECK (paddle_transaction_id ~ '^txn_[a-z0-9]+$'),
 paddle_price_id text NOT NULL CHECK (paddle_price_id ~ '^pri_[a-z0-9]+$'),
 environment text NOT NULL CHECK (environment IN ('sandbox','production')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id,subscription_id) REFERENCES tenant_subscriptions(tenant_id,id),
 UNIQUE (tenant_id,id),
 UNIQUE (tenant_id,id,paddle_transaction_id,subscription_id)
);
CREATE INDEX billing_paddle_checkout_tenant_idx ON billing_paddle_checkout_intents(tenant_id,subscription_id,created_at DESC);
CREATE TABLE billing_paddle_webhook_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 checkout_intent_id uuid NOT NULL,
 paddle_event_id text NOT NULL UNIQUE CHECK (paddle_event_id ~ '^evt_[a-z0-9]+$'),
 event_type text NOT NULL CHECK (event_type = 'transaction.completed'),
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
 received_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id,checkout_intent_id) REFERENCES billing_paddle_checkout_intents(tenant_id,id),
 UNIQUE (tenant_id,id,checkout_intent_id)
);
CREATE INDEX billing_paddle_receipts_tenant_idx ON billing_paddle_webhook_receipts(tenant_id,received_at DESC);
CREATE TABLE billing_paddle_settlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 subscription_id uuid NOT NULL,
 invoice_id uuid NOT NULL UNIQUE,
 checkout_intent_id uuid NOT NULL,
 receipt_id uuid NOT NULL UNIQUE,
 paddle_transaction_id text NOT NULL UNIQUE,
 amount_minor integer NOT NULL CHECK (amount_minor > 0),
 currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id,subscription_id) REFERENCES tenant_subscriptions(tenant_id,id),
 FOREIGN KEY (tenant_id,invoice_id) REFERENCES billing_invoices(tenant_id,id),
 FOREIGN KEY (tenant_id,checkout_intent_id,paddle_transaction_id,subscription_id)
   REFERENCES billing_paddle_checkout_intents(tenant_id,id,paddle_transaction_id,subscription_id),
 FOREIGN KEY (tenant_id,receipt_id,checkout_intent_id)
   REFERENCES billing_paddle_webhook_receipts(tenant_id,id,checkout_intent_id)
);
CREATE INDEX billing_paddle_settlements_tenant_idx ON billing_paddle_settlements(tenant_id,subscription_id,created_at DESC);
ALTER TABLE billing_paddle_checkout_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_paddle_checkout_intents FORCE ROW LEVEL SECURITY;
ALTER TABLE billing_paddle_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_paddle_webhook_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE billing_paddle_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_paddle_settlements FORCE ROW LEVEL SECURITY;
CREATE POLICY paddle_checkout_tenant_policy ON billing_paddle_checkout_intents
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY paddle_receipt_tenant_policy ON billing_paddle_webhook_receipts
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY paddle_settlement_tenant_policy ON billing_paddle_settlements
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
