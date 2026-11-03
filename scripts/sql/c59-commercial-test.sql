-- C59 REVIEW-ONLY schema: apply only to an isolated, authorized Stripe TEST database.
-- Do not run against production or a shared database without a separate approval.
CREATE SCHEMA IF NOT EXISTS commercial_test;
CREATE TABLE commercial_test.subscriptions (
 tenant_id text NOT NULL, account_id text NOT NULL, subscription_id text NOT NULL,
 last_event_created bigint NOT NULL DEFAULT 0, last_event_id text, last_decision text,
 PRIMARY KEY(tenant_id,account_id,subscription_id),
 UNIQUE(account_id,subscription_id)
);
CREATE TABLE commercial_test.events (
 tenant_id text NOT NULL, account_id text NOT NULL, event_id text NOT NULL,
 event_type text NOT NULL, status text NOT NULL, processed_at timestamptz,
 PRIMARY KEY(account_id,event_id)
);
CREATE TABLE commercial_test.entitlements (
 tenant_id text NOT NULL, account_id text NOT NULL, subscription_id text NOT NULL,
 enabled boolean NOT NULL DEFAULT false, source_event_id text NOT NULL,
 PRIMARY KEY(tenant_id,account_id,subscription_id),
 FOREIGN KEY(tenant_id,account_id,subscription_id)
  REFERENCES commercial_test.subscriptions(tenant_id,account_id,subscription_id)
);
ALTER TABLE commercial_test.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_test.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_test.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_test.subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE commercial_test.events FORCE ROW LEVEL SECURITY;
ALTER TABLE commercial_test.entitlements FORCE ROW LEVEL SECURITY;
CREATE POLICY subscription_tenant ON commercial_test.subscriptions
 USING (tenant_id = nullif(current_setting('app.tenant_id',true),''))
 WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),''));
CREATE POLICY event_tenant ON commercial_test.events
 USING (tenant_id = nullif(current_setting('app.tenant_id',true),''))
 WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),''));
CREATE POLICY entitlement_tenant ON commercial_test.entitlements
 USING (tenant_id = nullif(current_setting('app.tenant_id',true),''))
 WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),''));
-- Provisioning subscription rows must be performed by a separately authenticated,
-- tenant-scoped TEST-only onboarding flow. This migration never provisions tenants.
