// Standalone ORGAIZ sessions, independent of EPMO tenant authentication.
// Pure service boundary. Production requires a reviewed durable atomic adapter.
// Never pass session tokens in URLs, logs, JSON responses or cross-origin storage.
import {randomBytes,createHash} from 'node:crypto';

const deny=()=>{throw Error('ORGAIZ customer session unavailable')};
const text=x=>typeof x==='string'&&x.length>0&&x.length<=256&&!/[\x00-\x1f\x7f]/.test(x);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const tokenPattern=/^ogs1\.[A-Za-z0-9_-]{43}$/;
const sha256=x=>createHash('sha256').update(x).digest('hex');
const digest=token=>sha256('orgaiz:session:v1:'+token);
const required=(o,names)=>o&&names.every(k=>typeof o[k]==='function');
const validIdentity=x=>x&&x.identityProvider==='oidc'&&text(x.issuer)&&text(x.subject)&&
  x.epmoTenantBound===false&&x.gaizEntitled===false&&x.gaizDownloadAuthorized===false&&
  x.gaizImportAuthorized===false;
function safeCustomer(c,identity){
 if(!c||!uuid(c.id)||c.status!=='active'||c.issuer!==identity.issuer||
    c.subject!==identity.subject)deny();
 return c;
}
function safeClock(now){
 if(!Number.isSafeInteger(now)||now<1700000000)deny();
 return now;
}
/**
 * Each adapter operation MUST be transactional and parameterized:
 *  - upsertCustomerByIdentity is unique on (issuer,sub), never email
 *  - insertSession binds digest to customer and expiration
 *  - readSessionWithCustomer returns a joined current customer status
 *  - revokeSession and revokeAllSessionsForCustomer atomically update the DB.
 *
 * The resulting token is intended exclusively for an HttpOnly Secure SameSite
 * cookie set by a reviewed first-party callback controller (not implemented).
 */
export function createGaizCustomerSessionService({
 enabled=false,adapter,clock=()=>Math.floor(Date.now()/1000),ttlSeconds=3600
}={}){
 if(enabled!==true||!required(adapter,['upsertCustomerByIdentity','insertSession',
   'readSessionWithCustomer','revokeSession','revokeAllSessionsForCustomer'])||
   typeof clock!=='function'||!Number.isSafeInteger(ttlSeconds)||
   ttlSeconds<300||ttlSeconds>86400)deny();
 const now=()=>safeClock(clock());
 function principalFromRow(row,expiresAfter){
  if(!row||!uuid(row.id)||!uuid(row.customerId)||!text(row.issuer)||
     !text(row.subject)||row.customerStatus!=='active'||row.revokedAt!==null||
     !Number.isSafeInteger(row.expiresAt)||row.expiresAt<=expiresAfter)deny();
  return Object.freeze({
   authenticated:true,identityProvider:'oidc',epmoTenantBound:false,
   customerId:row.customerId,sessionId:row.id,issuer:row.issuer,subject:row.subject,
   gaizEntitled:false,gaizDownloadAuthorized:false,gaizImportAuthorized:false
  });
 }
 return Object.freeze({
  async issueFromTrustedCallback({identity,callbackVerified=false}={}){
   if(callbackVerified!==true||!validIdentity(identity))deny();
   const createdAt=now(),expiresAt=createdAt+ttlSeconds;
   const customer=safeCustomer(await adapter.upsertCustomerByIdentity({
    issuer:identity.issuer,subject:identity.subject
   }),identity);
   const token='ogs1.'+randomBytes(32).toString('base64url');
   const tokenDigest=digest(token);
   const inserted=await adapter.insertSession({
    customerId:customer.id,tokenDigest,createdAt,expiresAt
   });
   if(!inserted||!uuid(inserted.id)||inserted.customerId!==customer.id||
      inserted.expiresAt!==expiresAt)deny();
   return Object.freeze({
    token,expiresAt,customerId:customer.id,
    // Never treat creating an identity session as granting a purchase.
    gaizEntitled:false,gaizDownloadAuthorized:false,gaizImportAuthorized:false
   });
  },
  async requireCustomer(token){
   if(typeof token!=='string'||!tokenPattern.test(token))deny();
   const raw=Buffer.from(token.slice(5),'base64url');
   if(raw.length!==32||raw.toString('base64url')!==token.slice(5))deny();
   const row=await adapter.readSessionWithCustomer(digest(token));
   return principalFromRow(row,now());
  },
  async revoke(token){
   if(typeof token!=='string'||!tokenPattern.test(token))deny();
   await adapter.revokeSession(digest(token),now());
   return Object.freeze({revoked:true});
  },
  async revokeAll(token){
   // Validate the actual session token again; never accept a client-supplied
   // customerId or projected principal as proof for global logout.
   const principal=await this.requireCustomer(token);
   await adapter.revokeAllSessionsForCustomer(principal.customerId,now());
   return Object.freeze({revoked:true});
  }
 });
}
