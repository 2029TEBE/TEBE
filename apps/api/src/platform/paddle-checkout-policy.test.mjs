import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paddleApiTarget, paddleTransactionRequest, assertPaddleTransactionResponse } from './paddle-checkout-policy.ts';

const intent = { tenantId:'2bb4c19e-ac7d-47a3-8fa1-f917640e127a',
  invoiceId:'ae6c076e-c4fe-4cb0-9eda-476ea8d59024', priceId:'pri_'+'a'.repeat(26) };
const txId='txn_'+'b'.repeat(26);
const base='https://app.theepmo.com/billing/';
const payload=()=>({ data: { id:txId, status:'draft', collection_mode:'automatic',
  items:[{price_id:intent.priceId,quantity:1}],
  custom_data:{epmo_tenant_id:intent.tenantId,epmo_invoice_id:intent.invoiceId},
  checkout:{url:base+'?_ptxn='+txId} } });

test('environment pairing accepts only sandbox/staging and live/production',()=>{
  const sandbox=paddleApiTarget('sandbox','staging','pdl_sdbx_apikey_'+'x'.repeat(24));
  assert.equal(sandbox.baseUrl,'https://sandbox-api.paddle.com');
  assert.equal(sandbox.apiVersion,'1');
  assert.equal(paddleApiTarget('live','production','pdl_live_apikey_'+'x'.repeat(24)).baseUrl,'https://api.paddle.com');
  assert.throws(()=>paddleApiTarget('sandbox','production','pdl_sdbx_apikey_'+'x'.repeat(24)));
  assert.throws(()=>paddleApiTarget('live','staging','pdl_live_apikey_'+'x'.repeat(24)));
});
test('server-owned checkout constructs a single catalogued item',()=>{
  assert.deepEqual(paddleTransactionRequest(intent,base),{
    collection_mode:'automatic', items:[{price_id:intent.priceId,quantity:1}],
    checkout:{url:base},
    custom_data:{epmo_tenant_id:intent.tenantId,epmo_invoice_id:intent.invoiceId}
  });
});
test('valid provider response is not payment evidence',()=>{
  assert.deepEqual(assertPaddleTransactionResponse(payload(),intent,base),{
    transactionId:txId,url:base+'?_ptxn='+txId,paymentVerified:false
  });
});
test('rejects unrelated tenant or price and unapproved redirects',()=>{
  for(const change of [
    p=>{p.data.custom_data.epmo_tenant_id='other';},
    p=>{p.data.items[0].price_id='pri_'+'c'.repeat(26);},
    p=>{p.data.checkout.url='https://evil.example/?_ptxn='+txId;},
    p=>{p.data.checkout.url=base+'?_ptxn='+'txn_'+'x'.repeat(26);},
    p=>{p.data.checkout.url=base+'?_ptxn='+txId+'&next=https://evil.example';},
    p=>{p.data.status='completed';}
  ]){const p=payload();change(p);assert.throws(()=>assertPaddleTransactionResponse(p,intent,base));}
});
test('rejects malformed admin-provided price ids and insecure payment links',()=>{
  assert.throws(()=>paddleTransactionRequest({...intent,priceId:'free'},base));
  assert.throws(()=>paddleTransactionRequest(intent,'http://app.theepmo.com/billing/'));
  assert.throws(()=>paddleTransactionRequest(intent,'https://user:pass@app.theepmo.com/billing/'));
});
