import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyPaddleSignature, paddleEventIdentity } from './paddle-webhook-signature.mjs';

const secret='pdl_ntfset_synthetic_test_only_secret_never_real';
const now=1793720000;
const event={event_id:'evt_'+'a'.repeat(26),event_type:'transaction.completed',data:{id:'txn_'+ 'b'.repeat(26)}};
const body=Buffer.from(JSON.stringify(event));
const signed=(raw=body,t=now,sec=secret)=>'ts='+t+';h1='+createHmac('sha256',sec).update(String(t)).update(':').update(raw).digest('hex');

test('valid byte-exact Paddle signature only authenticates event identity',()=>{
 assert.equal(verifyPaddleSignature(body,signed(),secret,now),true);
 assert.deepEqual(paddleEventIdentity(body,signed(),secret,now),{id:event.event_id,type:event.event_type,objectId:event.data.id});
});
test('tampered body, signing secret, digest, stale, future and malformed headers fail closed',()=>{
 const invalid=[
 [Buffer.from(body.toString()+' '),signed(),secret,now],
 [body,signed(),secret+'wrong',now],
 [body,signed().replace(/.$/,'0'),secret,now],
 [body,signed(body,now-6),secret,now],
 [body,signed(body,now+6),secret,now],
 [body,signed()+';ts='+now,secret,now],
 [body,'ts=bad;h1='+ '0'.repeat(64),secret,now],
 [body,'ts='+now+';h1='+ 'a'.repeat(63),secret,now],
 [body,undefined,secret,now],
 [Buffer.alloc(1048577),signed(),secret,now]
 ];
 for (const x of invalid)assert.equal(verifyPaddleSignature(...x),false);
});
test('invalid event payload cannot become an entitlement, even with a valid signature',()=>{
 for (const value of [{event_id:'evt_'+'a'.repeat(26),event_type:'unknown',data:{id:'sub_1'}},{event_type:'transaction.completed',data:{id:'txn_1'}}]){
  const v=Buffer.from(JSON.stringify(value));
  assert.equal(paddleEventIdentity(v,signed(v),secret,now),null);
 }
});
