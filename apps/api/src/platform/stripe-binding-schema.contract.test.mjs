import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const sql=read('../../../../packages/db/proposals/stripe_billing_bindings_unapplied.sql');
const journal=read('../../../../packages/db/migrations/meta/_journal.json');
const rls=read('../../../../packages/db/sql/rls.sql');
test('Stripe proposal is intentionally out of migrations pending GAIZ journal reconciliation',()=>{
 assert.match(sql,/DESIGN PROPOSAL ONLY — DO NOT APPLY/);
 assert.doesNotMatch(journal,/stripe_billing_bindings/);
 assert.match(journal,/"tag": "0019_password_recovery"/);
});
test('all per-tenant binding and events use forced RLS',()=>{
 for(const t of ['stripe_billing_customer_bindings',
  'stripe_billing_subscription_bindings','stripe_billing_event_receipts']){
  assert.match(sql,new RegExp('ALTER TABLE public\\.'+t+' FORCE ROW LEVEL SECURITY'));
  assert.match(sql,new RegExp('CREATE POLICY [^\\n]+ ON public\\.'+t));
  assert.match(sql,new RegExp('tenant_id = NULLIF\\(current_setting'));
  assert.match(sql,new RegExp('REVOKE INSERT, UPDATE, DELETE ON public\\.stripe_billing_approved_prices,'));
 }
 assert.match(rls,/GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES/);
});
test('tenant + Stripe account + mode pin customer, price and subscriptions',()=>{
 assert.match(sql,/UNIQUE \(stripe_account_id,livemode,stripe_customer_id\)/);
 assert.match(sql,/UNIQUE \(stripe_account_id,livemode,stripe_price_id\)/);
 assert.match(sql,/CONSTRAINT stripe_binding_customer_fk FOREIGN KEY/);
 assert.match(sql,/CONSTRAINT stripe_binding_approved_price_fk FOREIGN KEY/);
 assert.match(sql,/CONSTRAINT stripe_binding_subscription_unique UNIQUE/);
 assert.match(sql,/CONSTRAINT stripe_binding_checkout_unique UNIQUE/);
 assert.match(sql,/CONSTRAINT stripe_event_exactly_once UNIQUE/);
});
test('approved prices demand independent reviewer, no arbitrary access grants',()=>{
 assert.match(sql,/approved_by <> requested_by/);
 assert.match(sql,/status IN \('pending','approved','revoked'\)/);
 assert.match(sql,/GRANT SELECT ON public\.stripe_billing_approved_prices/);
 assert.doesNotMatch(sql,/GRANT (?:INSERT|UPDATE|DELETE) ON .* TO pmo_app/);
 assert.doesNotMatch(sql,/UPDATE public\.tenant_subscriptions/);
 assert.doesNotMatch(sql,/stripe_secret_key|private_key|payment_method_details/i);
});
