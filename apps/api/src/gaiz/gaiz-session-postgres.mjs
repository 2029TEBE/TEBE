// Standalone ORGAIZ session persistence, parameterized PostgreSQL adapter.
// UNREGISTERED. No driver connection, migrations, production roles or RLS grants.
// A production pool MUST use a dedicated least-privilege role with reviewed
// policies and audited security-definer/worker boundaries.
const deny=()=>{throw Error('ORGAIZ session persistence unavailable')};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const text=x=>typeof x==='string'&&x.length>0&&x.length<=256;
const stamp=seconds=>{
 if(!Number.isSafeInteger(seconds)||seconds<1700000000||seconds>32503680000)deny();
 return new Date(seconds*1000);
};
const one=r=>Array.isArray(r?.rows)&&r.rows.length===1?r.rows[0]:null;
export function createGaizSessionPostgresAdapter({enabled=false,pool}={}){
 if(enabled!==true||!pool||typeof pool.query!=='function')deny();
 return Object.freeze({
  async upsertCustomerByIdentity({issuer,subject}={}){
   if(!text(issuer)||!text(subject))deny();
   const r=await pool.query(
    `INSERT INTO orgaiz_customers(issuer,subject,status)
     VALUES($1,$2,'active')
     ON CONFLICT(issuer,subject) DO UPDATE SET subject=EXCLUDED.subject
     RETURNING id,issuer,subject,status`,[issuer,subject]);
   const row=one(r);
   if(!row||!uuid(row.id)||row.issuer!==issuer||row.subject!==subject)deny();
   return row;
  },
  async insertSession({customerId,tokenDigest,createdAt,expiresAt}={}){
   if(!uuid(customerId)||!hex(tokenDigest)||!Number.isSafeInteger(createdAt)||
      !Number.isSafeInteger(expiresAt)||expiresAt<=createdAt)deny();
   const r=await pool.query(
    `INSERT INTO orgaiz_customer_sessions(customer_id,token_digest,created_at,expires_at)
     SELECT id,$2,$3,$4 FROM orgaiz_customers WHERE id=$1 AND status='active'
     RETURNING id,customer_id AS "customerId",
       floor(extract(epoch from expires_at))::integer AS "expiresAt"`,
     [customerId,tokenDigest,stamp(createdAt),stamp(expiresAt)]);
   const row=one(r);
   if(!row||!uuid(row.id)||row.customerId!==customerId||row.expiresAt!==expiresAt)deny();
   return row;
  },
  async readSessionWithCustomer(tokenDigest){
   if(!hex(tokenDigest))deny();
   const r=await pool.query(
    `SELECT s.id,s.customer_id AS "customerId",c.issuer,c.subject,
       c.status AS "customerStatus",s.revoked_at AS "revokedAt",
       floor(extract(epoch from s.expires_at))::integer AS "expiresAt"
     FROM orgaiz_customer_sessions s JOIN orgaiz_customers c ON c.id=s.customer_id
     WHERE s.token_digest=$1 LIMIT 1`,[tokenDigest]);
   return one(r);
  },
  async revokeSession(tokenDigest,nowSeconds){
   if(!hex(tokenDigest))deny();
   await pool.query(
    `UPDATE orgaiz_customer_sessions SET revoked_at=coalesce(revoked_at,$2)
      WHERE token_digest=$1`,[tokenDigest,stamp(nowSeconds)]);
  },
  async revokeAllSessionsForCustomer(customerId,nowSeconds){
   if(!uuid(customerId))deny();
   await pool.query(
    `UPDATE orgaiz_customer_sessions SET revoked_at=coalesce(revoked_at,$2)
      WHERE customer_id=$1 AND revoked_at IS NULL`,[customerId,stamp(nowSeconds)]);
  }
 });
}
