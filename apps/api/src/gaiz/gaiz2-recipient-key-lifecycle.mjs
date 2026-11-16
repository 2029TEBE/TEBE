/**
 * Development-only pure key lifecycle planner.
 * Backend must authenticate registrar, lock tenant row and perform atomic
 * compare-and-swap plus audit; this module does none of those operations.
 */
const deny=()=>{throw Error('GAIZ2 recipient key transition denied')};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const transitions={pending:['active','revoked'],active:['suspended','revoked','retired'],suspended:['active','revoked','retired'],revoked:[],retired:[]};
const exact=(x,ks)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join(',')===ks.slice().sort().join(',');
const keys=['tenantId','recipientKeyId','keyVersion','state','revision','notBeforeMs','notAfterMs','revokedAtMs'];
const inputs=['tenantId','recipientKeyId','keyVersion','expectedRevision','nextState','reasonCode','actorId','nowMs'];
export function planGaiz2RecipientKeyTransition(current,request){
 if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')deny();
 if(!exact(current,keys)||!exact(request,inputs))deny();
 if(!UUID.test(current.tenantId)||!UUID.test(request.tenantId)||!UUID.test(request.actorId)||
    current.tenantId!==request.tenantId||!ID.test(current.recipientKeyId)||!ID.test(current.keyVersion)||
    current.recipientKeyId!==request.recipientKeyId||current.keyVersion!==request.keyVersion||
    !Number.isSafeInteger(current.revision)||current.revision<1||
    !Number.isSafeInteger(request.expectedRevision)||current.revision!==request.expectedRevision||
    !Number.isSafeInteger(request.nowMs)||request.nowMs<=0||
    !Number.isSafeInteger(current.notBeforeMs)||!Number.isSafeInteger(current.notAfterMs)||
    current.notBeforeMs>=current.notAfterMs||
    typeof request.reasonCode!=='string'||!/^[A-Z][A-Z0-9_]{2,63}$/.test(request.reasonCode))deny();
 if(!Object.hasOwn(transitions,current.state)||!transitions[current.state].includes(request.nextState)||
    current.revokedAtMs!==null)deny();
 if(request.nextState==='active'&&(request.nowMs<current.notBeforeMs||request.nowMs>=current.notAfterMs))deny();
 if(current.revision===Number.MAX_SAFE_INTEGER)deny();
 const next=Object.freeze({...current,state:request.nextState,revision:current.revision+1,
  revokedAtMs:request.nextState==='revoked'?request.nowMs:null});
 return Object.freeze({next,expectedRevision:current.revision,
  audit:Object.freeze({tenantId:current.tenantId,recipientKeyId:current.recipientKeyId,
   keyVersion:current.keyVersion,actorId:request.actorId,eventType:request.nextState,
   reasonCode:request.reasonCode}),
  databaseCompareAndSwapRequired:true,independentRegistrarAuthenticationRequired:true,
  kmsReleaseAllowed:false,importAllowed:false});
}
