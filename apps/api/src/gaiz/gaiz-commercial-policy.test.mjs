import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeGaizOrderRead,transitionGaizOrder,authorizeGaizArtifact} from './gaiz-commercial-policy.mjs';
const principal={authenticated:true,identityProvider:'oidc',epmoTenantBound:false,
 customerId:'customer-a',issuer:'https://issuer.example.test/',subject:'sub-1',sessionId:'session-a'};
const order={id:'order-a',customerId:'customer-a',toolId:'report-demo',
 currency:'USD',amountMinor:1000,providerTransactionId:'txn-a',state:'awaiting_payment',revision:1};
const paymentProof={verifiedByServer:true,providerTransactionId:'txn-a',customerId:'customer-a',
 amountMinor:1000,currency:'USD',status:'paid',environment:'approved'};
const executionProof={verifiedByServer:true,orderId:'order-a',customerId:'customer-a',entitled:true};
const fail=fn=>assert.throws(fn,/ORGAIZ commercial operation denied/);
test('correct customer may inspect but cannot mark paid without verified provider event',()=>{
 assert.deepEqual(authorizeGaizOrderRead({principal,order}),{orderId:'order-a',state:'awaiting_payment'});
 fail(()=>transitionGaizOrder({principal,order,nextState:'paid',expectedRevision:1}));
 fail(()=>transitionGaizOrder({principal,order,nextState:'paid',expectedRevision:1,paymentProof:{...paymentProof,amountMinor:999}}));
 fail(()=>transitionGaizOrder({principal,order,nextState:'paid',expectedRevision:0,paymentProof}));
 const result=transitionGaizOrder({principal,order,nextState:'paid',expectedRevision:1,paymentProof});
 assert.equal(result.state,'paid');assert.equal(result.revision,2);
 assert.equal(order.state,'awaiting_payment');
});
test('cross-customer, unauthenticated and EPMO-session-only callers are refused',()=>{
 for(const changed of [
  {...principal,customerId:'other'},
  {...principal,authenticated:false},
  {...principal,identityProvider:'epmo-session'},
  {...principal,epmoTenantBound:true},
  {...principal,sessionId:''}
 ])fail(()=>authorizeGaizOrderRead({principal:changed,order}));
});
test('job transitions require independently confirmed entitlement and CAS',()=>{
 const paid={...order,state:'paid',revision:2};
 fail(()=>transitionGaizOrder({principal,order:paid,nextState:'queued',expectedRevision:2}));
 fail(()=>transitionGaizOrder({principal,order:paid,nextState:'queued',expectedRevision:2,executionProof:{...executionProof,entitled:false}}));
 const queued=transitionGaizOrder({principal,order:paid,nextState:'queued',expectedRevision:2,executionProof});
 assert.equal(queued.state,'queued');
 fail(()=>transitionGaizOrder({principal,order:queued,nextState:'completed',expectedRevision:3,executionProof}));
});
test('downloads require completed paid-owned report, verified artifact and fresh expiry',()=>{
 const done={...order,state:'completed',revision:5};
 const job={id:'job-a',orderId:'order-a',customerId:'customer-a',state:'completed'};
 const artifact={id:'artifact-a',jobId:'job-a',customerId:'customer-a',format:'pdf',
  expiresAt:1800000000,revoked:false,verifiedByServer:true};
 assert.equal(authorizeGaizArtifact({principal,order:done,job,artifact,nowSeconds:1790000000}).authorized,true);
 for(const ch of [
  {order:{...done,state:'refunded'}},
  {job:{...job,customerId:'other'}},
  {artifact:{...artifact,customerId:'other'}},
  {artifact:{...artifact,revoked:true}},
  {artifact:{...artifact,verifiedByServer:false}},
  {nowSeconds:1800000000}
 ])fail(()=>authorizeGaizArtifact({principal,order:ch.order??done,job:ch.job??job,
  artifact:ch.artifact??artifact,nowSeconds:ch.nowSeconds??1790000000}));
});
