import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const schema=readFileSync(new URL('../../../../packages/db/migrations/0023_paddle_ledger.sql',import.meta.url),'utf8');
test('Paddle transaction replay cannot insert duplicate receipt, settlement or invoice',()=>{
 for(const fragment of ['paddle_event_id text NOT NULL UNIQUE','paddle_transaction_id text NOT NULL UNIQUE','receipt_id uuid NOT NULL UNIQUE','invoice_id uuid NOT NULL UNIQUE'])
 assert.ok(schema.includes(fragment),fragment);
});
test('Paddle ledger enforces tenant composite bindings',()=>{
 assert.match(schema,/FOREIGN KEY \(tenant_id,checkout_intent_id,paddle_transaction_id,subscription_id\)/);
 assert.match(schema,/FOREIGN KEY \(tenant_id,receipt_id,checkout_intent_id\)/);
});
