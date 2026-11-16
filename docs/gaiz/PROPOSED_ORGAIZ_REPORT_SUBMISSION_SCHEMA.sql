-- REVIEW ONLY: not a production migration. Entire change is ROLLED BACK.
-- Requires reviewed original ORGAIZ commerce + worker proposals and RLS.
-- No accounts, entitlements or provider settlement are created here.
BEGIN;
ALTER TABLE orgaiz_jobs
 ADD COLUMN IF NOT EXISTS idempotency_digest char(64),
 ADD COLUMN IF NOT EXISTS request_digest char(64);
-- Report submissions use one purchased order per job (stronger than
-- idempotency-key uniqueness). Must reconcile existing rows before migration.
CREATE UNIQUE INDEX IF NOT EXISTS orgaiz_jobs_one_per_order
 ON orgaiz_jobs(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS orgaiz_jobs_customer_order_idempotency
 ON orgaiz_jobs(customer_id,order_id,idempotency_digest);
-- PostgreSQL UNIQUE allows multiple NULL values: a production forward
-- migration must backfill any old jobs and make digests NOT NULL for new jobs.
-- The existing queue proposal already supplies deadline_at, inputs,
-- worker_key, format, attempts, and entitlement + job audit tables.
-- Entitlements used for real paid report issuance must originate in a
-- verified settlement ledger and be linked to that ledger by an immutable
-- foreign key; granted_by='verified_payment' is NOT itself proof of payment.
-- Do not add a public INSERT/UPDATE policy on entitlement tables.
-- Dedicated service role, row-level access and full audit required.
ROLLBACK;
