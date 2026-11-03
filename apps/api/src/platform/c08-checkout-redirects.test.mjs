import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePaddleSandboxSettlement } from '../../../../scripts/paddle-sandbox-settlement-policy.mjs';
test('no checkout return or unsigned event proves payment',()=>{
 assert.deepEqual(evaluatePaddleSandboxSettlement(null,null,{signatureVerified:false}),
   {accepted:false,reason:'signature_not_verified'});
 assert.equal(evaluatePaddleSandboxSettlement({event_type:'transaction.completed'},null,{signatureVerified:true}).accepted,false);
});
test('Paddle settlement requires server-created tenant-bound intent',()=>{
 const event={event_id:'evt_'+'a'.repeat(26),event_type:'transaction.completed',
  data:{id:'txn_'+'b'.repeat(26),status:'completed'}};
 const result=evaluatePaddleSandboxSettlement(event,null,{signatureVerified:true});
 assert.deepEqual(result,{accepted:false,reason:'untrusted_intent'});
});
