// Standalone ORGAIZ commercial fulfilment security policy.
// Pure checks ONLY. Storage, payment-provider webhook signature validation,
// durable uniqueness, transactions, and artifact byte delivery must be server-side.
// Do not treat customer input, a checkout return URL or an OIDC token as purchase evidence.
const deny=()=>{throw Error('ORGAIZ commercial operation denied')};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const positiveInt=x=>Number.isSafeInteger(x)&&x>0;
const knownFormats=new Set(['pdf','html','gaiz']);
const allowedStates=Object.freeze({
  created:Object.freeze(['awaiting_payment','canceled']),
  awaiting_payment:Object.freeze(['paid','canceled','expired']),
  paid:Object.freeze(['queued','refunded','canceled']),
  queued:Object.freeze(['processing','refunded','canceled']),
  processing:Object.freeze(['completed','failed','refunded']),
  completed:Object.freeze(['refunded','expired']),
  failed:Object.freeze([]),
  canceled:Object.freeze([]),
  refunded:Object.freeze([]),
  expired:Object.freeze([]),
});
function customer(p){
 if(!p||p.authenticated!==true||p.identityProvider!=='oidc'||p.epmoTenantBound!==false||
 !id(p.customerId)||!id(p.issuer)||!id(p.subject)||!id(p.sessionId))deny();
 return p;
}
function order(o){
 if(!o||!id(o.id)||!id(o.customerId)||!id(o.toolId)||!id(o.currency)||
 !positiveInt(o.amountMinor)||!id(o.providerTransactionId)||
 !Object.hasOwn(allowedStates,o.state)||!Number.isSafeInteger(o.revision)||o.revision<0)deny();
 return o;
}
function requireOwner(ctx,o){
 customer(ctx);order(o);
 if(ctx.customerId!==o.customerId)deny();
 return true;
}
export function authorizeGaizOrderRead({principal,order:record}={}){
 requireOwner(principal,record);
 return Object.freeze({orderId:record.id,state:record.state});
}
/** Signed payment events must be independently authenticated and mapped to a
 * canonical provider transaction by the server; caller-supplied proof is invalid. */
export function transitionGaizOrder({principal,order:record,nextState,expectedRevision,
 paymentProof,executionProof}={}){
 requireOwner(principal,record);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==record.revision||
 !Array.isArray(allowedStates[record.state])||
 !allowedStates[record.state].includes(nextState))deny();
 if(nextState==='paid'){
  if(!paymentProof||paymentProof.verifiedByServer!==true||
     paymentProof.providerTransactionId!==record.providerTransactionId||
     paymentProof.customerId!==record.customerId||
     paymentProof.amountMinor!==record.amountMinor||
     paymentProof.currency!==record.currency||
     paymentProof.status!=='paid'||paymentProof.environment!=='approved')deny();
 }
 if(nextState==='queued'||nextState==='processing'||nextState==='completed'){
  if(!executionProof||executionProof.verifiedByServer!==true||
     executionProof.orderId!==record.id||
     executionProof.customerId!==record.customerId||
     executionProof.entitled!==true)deny();
 }
 // A successful policy decision is not a durable entitlement until storage
 // atomically writes revision, ledger event and audit in one transaction.
 return Object.freeze({...record,state:nextState,revision:record.revision+1});
}
/** Server MUST independently recheck customer session, paid order, ownership,
 * refund/revocation, job status and object storage existence on every GET.
 * GAIZ2 signature verification is orthogonal to entitlement. */
export function authorizeGaizArtifact({principal,order:record,job,artifact,nowSeconds}={}){
 requireOwner(principal,record);
 if(!job||!artifact||!id(job.id)||!id(job.orderId)||!id(job.customerId)||
 !id(artifact.id)||!id(artifact.jobId)||!id(artifact.customerId)||
 !knownFormats.has(artifact.format)||job.orderId!==record.id||
 job.customerId!==record.customerId||artifact.jobId!==job.id||
 artifact.customerId!==record.customerId||
 job.state!=='completed'||record.state!=='completed'||
 artifact.revoked!==false||artifact.verifiedByServer!==true||
 !Number.isSafeInteger(artifact.expiresAt)||!Number.isSafeInteger(nowSeconds)||
 nowSeconds>=artifact.expiresAt||nowSeconds<0)deny();
 return Object.freeze({orderId:record.id,jobId:job.id,artifactId:artifact.id,format:artifact.format,
  authorized:true,authorizedCustomerId:principal.customerId});
}
export const gaizCommercialTransitions=allowedStates;
