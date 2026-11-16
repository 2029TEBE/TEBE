-- REVIEW-ONLY ORGAIZ commerce schema proposal. NOT a migration; DO NOT APPLY.
-- Standalone customers are NOT EPMO tenants. A customer identity is issuer+subject,
-- not email; never infer EPMO tenant membership from these tables.
-- Exact naming, residency, encryption, data retention and roles require DBA review.
BEGIN;
CREATE TABLE IF NOT EXISTS orgaiz_customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 issuer text NOT NULL,
 subject text NOT NULL,
 status text NOT NULL CHECK(status IN ('active','suspended','deleted')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(issuer,subject)
);
CREATE TABLE IF NOT EXISTS orgaiz_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES orgaiz_customers(id),
 tool_id text NOT NULL,
 currency char(3) NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 provider text NOT NULL,
 provider_transaction_id text NOT NULL,
 state text NOT NULL CHECK(state IN ('created','awaiting_payment','paid','queued',
 'processing','completed','failed','canceled','refunded','expired')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,provider_transaction_id)
);
CREATE INDEX IF NOT EXISTS orgaiz_orders_owner_idx ON orgaiz_orders(customer_id,id);
CREATE TABLE IF NOT EXISTS orgaiz_order_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES orgaiz_orders(id),
 event_namespace text NOT NULL,
 external_event_id text NOT NULL,
 event_hash char(64) NOT NULL,
 state_before text NOT NULL,
 state_after text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_namespace,external_event_id)
);
CREATE TABLE IF NOT EXISTS orgaiz_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES orgaiz_orders(id),
 customer_id uuid NOT NULL REFERENCES orgaiz_customers(id),
 state text NOT NULL CHECK(state IN ('queued','processing','completed','failed','expired','canceled')),
 tool_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS orgaiz_jobs_owner_idx ON orgaiz_jobs(customer_id,order_id,id);
CREATE TABLE IF NOT EXISTS orgaiz_artifacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_id uuid NOT NULL REFERENCES orgaiz_jobs(id),
 customer_id uuid NOT NULL REFERENCES orgaiz_customers(id),
 format text NOT NULL CHECK(format IN ('pdf','html','gaiz')),
 encrypted_object_key text NOT NULL,
 sha256 char(64) NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orgaiz_artifacts_owner_idx ON orgaiz_artifacts(customer_id,job_id,id);
-- No direct public roles. Server-side worker and customer session adapters
-- must enforce customer ownership; object storage has no public bucket.
ALTER TABLE orgaiz_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_customers FORCE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_order_events FORCE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE orgaiz_artifacts FORCE ROW LEVEL SECURITY;
-- NO RLS policies created here: intentional deny-by-default.
-- Production needs reviewed per-customer and trusted worker policies,
-- atomic CAS/unique claims, and audit permissions before use.
ROLLBACK;
