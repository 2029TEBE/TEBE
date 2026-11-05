-- Disposable CI-only PostgreSQL acceptance: does not persist any fixture.
-- The workflow enforces CI, acknowledged localhost and admin role before invoking.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE epmo_paddle_ci_fixture (
  tenant_a uuid NOT NULL, tenant_b uuid NOT NULL,
  plan_id uuid NOT NULL, subscription_a uuid NOT NULL, subscription_b uuid NOT NULL,
  invoice_a uuid NOT NULL, checkout_a uuid NOT NULL, receipt_a uuid NOT NULL
) ON COMMIT DROP;
INSERT INTO epmo_paddle_ci_fixture
SELECT
  (SELECT id FROM public.tenants WHERE slug = 'al-nakheel' LIMIT 1),
  (SELECT id FROM public.tenants WHERE slug = 'nexa' LIMIT 1),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid();
GRANT SELECT ON epmo_paddle_ci_fixture TO pmo_app;

-- Administrative setup in a transaction whose changes will be rolled back.
INSERT INTO public.subscription_plans
  (id,code,name,price_minor,currency,billing_interval)
SELECT plan_id,'paddle-ci-temporary-plan','Paddle disposable CI plan',11500,'SAR','monthly'
FROM epmo_paddle_ci_fixture;
INSERT INTO public.tenant_subscriptions
  (id,tenant_id,plan_id,status,period_starts_at,period_ends_at)
SELECT subscription_a,tenant_a,plan_id,'trialing',now(),now()+interval '30 days'
FROM epmo_paddle_ci_fixture
UNION ALL
SELECT subscription_b,tenant_b,plan_id,'trialing',now(),now()+interval '30 days'
FROM epmo_paddle_ci_fixture;
INSERT INTO public.billing_invoices
  (id,tenant_id,subscription_id,period_starts_at,period_ends_at,amount_minor,currency)
SELECT invoice_a,tenant_a,subscription_a,now(),now()+interval '30 days',11500,'SAR'
FROM epmo_paddle_ci_fixture;

-- Verify actual, restricted app_role writes and reads; never use the owner role.
SET LOCAL ROLE pmo_app;
SELECT set_config('app.tenant_id', tenant_a::text, true) FROM epmo_paddle_ci_fixture;
INSERT INTO public.billing_paddle_checkout_intents
  (id,tenant_id,subscription_id,plan_id,paddle_transaction_id,paddle_price_id,environment,expires_at)
SELECT checkout_a,tenant_a,subscription_a,plan_id,
  'txn_paddlecitesta','pri_paddlecitesta','sandbox',now()+interval '15 minutes'
FROM epmo_paddle_ci_fixture;
INSERT INTO public.billing_paddle_webhook_receipts
  (id,tenant_id,checkout_intent_id,paddle_event_id,event_type,payload_sha256)
SELECT receipt_a,tenant_a,checkout_a,'evt_paddlecitesta',
  'transaction.completed',repeat('a',64)
FROM epmo_paddle_ci_fixture;
INSERT INTO public.billing_paddle_settlements
  (tenant_id,subscription_id,invoice_id,checkout_intent_id,receipt_id,
   paddle_transaction_id,amount_minor,currency)
SELECT tenant_a,subscription_a,invoice_a,checkout_a,receipt_a,
  'txn_paddlecitesta',11500,'SAR'
FROM epmo_paddle_ci_fixture;

DO $assert$
BEGIN
  IF (SELECT count(*) FROM public.billing_paddle_settlements) <> 1 THEN
    RAISE EXCEPTION 'Tenant A cannot read its own settlement';
  END IF;
  IF has_table_privilege('pmo_app','public.billing_paddle_checkout_intents','UPDATE')
     OR has_table_privilege('pmo_app','public.billing_paddle_webhook_receipts','DELETE')
     OR has_table_privilege('pmo_app','public.billing_paddle_settlements','UPDATE') THEN
    RAISE EXCEPTION 'Append-only Paddle ledger privileges violated';
  END IF;
END $assert$;

-- Switch the same pooled session to tenant B and verify the A data vanishes.
SELECT set_config('app.tenant_id', tenant_b::text, true) FROM epmo_paddle_ci_fixture;
DO $assert$
DECLARE a uuid; s uuid; p uuid;
BEGIN
  IF EXISTS(SELECT 1 FROM public.billing_paddle_checkout_intents) OR
     EXISTS(SELECT 1 FROM public.billing_paddle_webhook_receipts) OR
     EXISTS(SELECT 1 FROM public.billing_paddle_settlements) THEN
    RAISE EXCEPTION 'Paddle cross-tenant read leaked';
  END IF;
  SELECT tenant_a,subscription_a,plan_id INTO a,s,p FROM epmo_paddle_ci_fixture;
  BEGIN
    INSERT INTO public.billing_paddle_checkout_intents
      (tenant_id,subscription_id,plan_id,paddle_transaction_id,paddle_price_id,environment,expires_at)
    VALUES (a,s,p,'txn_paddleciforeign','pri_paddlecitesta','sandbox',now()+interval '15 minutes');
    RAISE EXCEPTION 'Paddle cross-tenant insert unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $assert$;

-- Restore tenant A and prove that repeating a provider event cannot insert a
-- second receipt, even with a new local receipt UUID.
SELECT set_config('app.tenant_id', tenant_a::text, true) FROM epmo_paddle_ci_fixture;
DO $assert$
DECLARE a uuid; checkout uuid;
BEGIN
  SELECT tenant_a,checkout_a INTO a,checkout FROM epmo_paddle_ci_fixture;
  BEGIN
    INSERT INTO public.billing_paddle_webhook_receipts
      (tenant_id,checkout_intent_id,paddle_event_id,event_type,payload_sha256)
    VALUES (a,checkout,'evt_paddlecitesta','transaction.completed',repeat('a',64));
    RAISE EXCEPTION 'Duplicate Paddle event accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $assert$;
ROLLBACK;
\echo PASS: disposable Paddle tenant A/B RLS, append-only grants and duplicate-event denial
