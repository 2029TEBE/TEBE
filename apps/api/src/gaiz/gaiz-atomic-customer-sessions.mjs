// REVIEW-ONLY PostgreSQL transaction boundary for standalone ORGAIZ identity.
// Requires an injected, least-privilege pg Pool and reviewed RLS policies.
// Unregistered and disabled; no migration or production connection.
import {createHash,randomBytes} from 'node:crypto';

const deny=()=>{throw new Error('ORGAIZ transactional session unavailable')};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const label=x=>typeof x==='string'&&x.length>0&&x.length<=128&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(x);
const issuer=x=>{
 if(typeof x!=='string'||x.length>512)return false;
 try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&
  !u.search&&!u.hash&&u.href===x}catch{return false}
};
const tokenPattern=/^ogs1\.[A-Za-z0-9_-]{43}$/;
const digest=t=>createHash('sha256').update('orgaiz:session:v1:'+t).digest('hex');
const timeValue=t=>{if(!Number.isSafeInteger(t)||t<1700000000||t>32503680000)deny();return new Date(t*1000)};
function validToken(t){
 if(!tokenPattern.test(t||''))deny();
 const raw=Buffer.from(t.slice(5),'base64url');
 if(raw.length!==32||raw.toString('base64url')!==t.slice(5))deny();
 return t;
}
function validIdentity(i){
 // Only callback-owned, plain data can assert identity or disabled entitlements.
 // Inherited authorization claims must never be treated as trusted facts.
 if(!i||typeof i!=='object'||Object.getPrototypeOf(i)!==Object.prototype||
    !['identityProvider','issuer','subject','epmoTenantBound','gaizEntitled',
      'gaizDownloadAuthorized','gaizImportAuthorized'].every(k=>
       Object.hasOwn(i,k)&&Object.getOwnPropertyDescriptor(i,k)?.get===undefined))deny();
 if(i.identityProvider!=='oidc'||i.epmoTenantBound!==false||
    i.gaizEntitled!==false||i.gaizDownloadAuthorized!==false||
    i.gaizImportAuthorized!==false||!issuer(i.issuer)||!label(i.subject))deny();
 return i;
}
function one(r){return Array.isArray(r?.rows)&&r.rows.length===1?r.rows[0]:null}
export function createGaizAtomicCustomerSessions({
 enabled=false,pool,clock=()=>Math.floor(Date.now()/1000),ttlSeconds=3600
}={}){
 if(enabled!==true||!pool||typeof pool.connect!=='function'||
  typeof pool.query!=='function'||typeof clock!=='function'||
  !Number.isSafeInteger(ttlSeconds)||ttlSeconds<300||ttlSeconds>86400)deny();
 const now=()=>{const n=clock();timeValue(n);return n};
 async function transaction(fn){
  const client=await pool.connect();
  if(!client||typeof client.query!=='function'||typeof client.release!=='function')deny();
  let began=false;
  try{
   await client.query('BEGIN');began=true;
   // The dedicated DB role must have a reviewed RLS policy and must not BYPASSRLS.
   const result=await fn(client);
   await client.query('COMMIT');began=false;
   return result;
  }catch{
   if(began){try{await client.query('ROLLBACK')}catch{}}
   deny(); // Fail closed without leaking SQL rows, secrets, or PII.
  }finally{client.release()}
 }
 function rowToPrincipal(row,currentTime){
  if(!row||!uuid(row.id)||!uuid(row.customerId)||!issuer(row.issuer)||
     !label(row.subject)||row.customerStatus!=='active'||row.revokedAt!==null||
     !Number.isSafeInteger(row.expiresAt)||row.expiresAt<=currentTime)deny();
  return Object.freeze({
   authenticated:true,identityProvider:'oidc',epmoTenantBound:false,
   customerId:row.customerId,sessionId:row.id,issuer:row.issuer,subject:row.subject,
   gaizEntitled:false,gaizDownloadAuthorized:false,gaizImportAuthorized:false
  });
 }
 return Object.freeze({
  async issueFromTrustedCallback({identity,callbackVerified=false}={}){
   if(callbackVerified!==true)deny();
   validIdentity(identity);
   const createdAt=now(),expiresAt=createdAt+ttlSeconds;
   const token='ogs1.'+randomBytes(32).toString('base64url');
   const tokenDigest=digest(token);
   const row=await transaction(async client=>{
    // Atomic upsert + session issuance. Existing suspended customer must
    // never be reactivated simply because their identity provider logged in.
    const customer=one(await client.query(
     `INSERT INTO orgaiz_customers(issuer,subject,status)
      VALUES($1,$2,'active')
      ON CONFLICT(issuer,subject) DO UPDATE SET subject=EXCLUDED.subject
      RETURNING id,issuer,subject,status`,[identity.issuer,identity.subject]));
    if(!customer||!uuid(customer.id)||customer.status!=='active'||
       customer.issuer!==identity.issuer||customer.subject!==identity.subject)deny();
    const inserted=one(await client.query(
     `INSERT INTO orgaiz_customer_sessions(customer_id,token_digest,created_at,expires_at)
      VALUES($1,$2,$3,$4)
      RETURNING id,customer_id AS "customerId",
       floor(extract(epoch from expires_at))::bigint AS "expiresAt"`,
     [customer.id,tokenDigest,timeValue(createdAt),timeValue(expiresAt)]));
    if(!inserted||!uuid(inserted.id)||inserted.customerId!==customer.id||
       Number(inserted.expiresAt)!==expiresAt)deny();
    return customer;
   });
   // Only return the bearer token after the database COMMIT succeeded.
   return Object.freeze({token,expiresAt,customerId:row.id,
     gaizEntitled:false,gaizDownloadAuthorized:false,gaizImportAuthorized:false});
  },
  async requireCustomer(token){
   validToken(token);
   const result=one(await pool.query(
    `SELECT s.id,s.customer_id AS "customerId",c.issuer,c.subject,
      c.status AS "customerStatus",s.revoked_at AS "revokedAt",
      floor(extract(epoch from s.expires_at))::bigint AS "expiresAt"
      FROM orgaiz_customer_sessions s
      JOIN orgaiz_customers c ON c.id=s.customer_id
      WHERE s.token_digest=$1 LIMIT 1`,[digest(token)]));
   if(result)result.expiresAt=Number(result.expiresAt);
   return rowToPrincipal(result,now());
  },
  async revoke(token){
   validToken(token);
   await pool.query(
    `UPDATE orgaiz_customer_sessions SET revoked_at=COALESCE(revoked_at,$2)
      WHERE token_digest=$1`,[digest(token),timeValue(now())]);
   return Object.freeze({revoked:true});
  },
  async revokeAll(token){
   validToken(token);
   const currentTime=now();
   await transaction(async client=>{
    const row=one(await client.query(
     `SELECT s.id,s.customer_id AS "customerId",c.issuer,c.subject,
       c.status AS "customerStatus",s.revoked_at AS "revokedAt",
       floor(extract(epoch from s.expires_at))::bigint AS "expiresAt"
       FROM orgaiz_customer_sessions s
       JOIN orgaiz_customers c ON c.id=s.customer_id
       WHERE s.token_digest=$1 FOR UPDATE OF s,c`,[digest(token)]));
    if(row)row.expiresAt=Number(row.expiresAt);
    const p=rowToPrincipal(row,currentTime);
    await client.query(
     `UPDATE orgaiz_customer_sessions SET revoked_at=COALESCE(revoked_at,$2)
      WHERE customer_id=$1 AND revoked_at IS NULL`,[p.customerId,timeValue(currentTime)]);
   });
   return Object.freeze({revoked:true});
  }
 });
}
