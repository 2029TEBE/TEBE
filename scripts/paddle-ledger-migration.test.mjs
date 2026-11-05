import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyRepositoryMigrations } from './verify-migration-chain.mjs';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root),'utf8');
const sql=read('packages/db/migrations/0023_paddle_ledger.sql');
const rls=read('packages/db/sql/rls.sql');
const schema=read('packages/db/src/schema.ts');
test('Paddle native settlement migration has pinned ordered source bytes',()=>{
 const evidence=verifyRepositoryMigrations();
 assert.equal(evidence.latest,'0026_evaluation_seven_day');
 assert.equal(evidence.checksumsVerified,true);
 assert.equal(evidence.count,27);
});
test('Paddle ledger is FORCE RLS, tenant scoped, and append-only',()=>{
 for(const name of ['billing_paddle_checkout_intents','billing_paddle_webhook_receipts','billing_paddle_settlements']){
  assert.match(sql,new RegExp('CREATE TABLE '+name));
  assert.match(sql,new RegExp('ALTER TABLE '+name+' FORCE ROW LEVEL SECURITY'));
  assert.ok(schema.includes("'"+name+"'"));
  assert.ok(rls.includes(name));
 }
 assert.match(rls,/REVOKE UPDATE, DELETE ON billing_paddle_checkout_intents/);
});
test('Paddle settlement must link same tenant, subscription, receipt, invoice and transaction',()=>{
 assert.match(sql,/FOREIGN KEY \(tenant_id,checkout_intent_id,paddle_transaction_id,subscription_id\)/);
 assert.match(sql,/FOREIGN KEY \(tenant_id,receipt_id,checkout_intent_id\)/);
 assert.match(sql,/paddle_event_id text NOT NULL UNIQUE/);
 assert.match(sql,/paddle_transaction_id text NOT NULL UNIQUE/);
 assert.match(sql,/invoice_id uuid NOT NULL UNIQUE/);
});
test('No historical Stripe records are reclassified, deleted or migrated by schema',()=>{
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM|UPDATE billing_stripe|INSERT INTO billing_stripe/i);
 assert.doesNotMatch(sql,/INSERT INTO billing_payments|UPDATE billing_payments/i);
 assert.match(sql,/no Stripe backfill or delete/i);
});
