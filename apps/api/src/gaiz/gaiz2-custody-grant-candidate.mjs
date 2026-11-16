/**
 * GAIZ2 development-only custody-grant verifier: NO unwrap or KMS calls.
 *
 * A separately administered custodian policy issuer signs an exact, short-lived
 * approval to *evaluate* one recipient use. This is not an entitlement,
 * transport credential, KMS token or authorization to release a DEK.
 * The backend must independently pin this issuer and derive expected metadata
 * from signed GAIZ2 bytes plus the database-claimed workload assignment.
 *
 * No production registration, public route, plaintext or private keys.
 */
import {createPublicKey,verify as edVerify} from 'node:crypto';

const deny=()=>{throw Error('GAIZ2 custody grant denied')};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA=/^[a-f0-9]{64}$/;
const B64=/^[A-Za-z0-9_-]+$/;
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&
 Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
const canonical=x=>'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+JSON.stringify(x[k])).join(',')+'}';
const dec=(x,max)=>{
 if(typeof x!=='string'||x.length===0||x.length>max*2||!B64.test(x))deny();
 const b=Buffer.from(x,'base64url');
 if(b.length>max||b.toString('base64url')!==x)deny();
 return b;
};
const fields=['version','issuerId','tenantId','workerId','workItemId','assignmentId',
 'artifactId','artifactIssuerId','envelopeSha256','recipientKeyId','purpose',
 'issuedAtMs','expiresAtMs'];
const expectedFields=['tenantId','workerId','workItemId','assignmentId','artifactId',
 'artifactIssuerId','envelopeSha256','recipientKeyId'];

/**
 * `expected` must be backend-derived from previously authenticated immutable
 * evidence; do not pass any request-body, AI-generated or token-supplied values.
 */
export function verifyGaiz2CustodyGrantCandidate(encoded,{
 trustedCustodyIssuerPublicKey,expectedCustodyIssuerId,expected,nowMs,
}={}){
 if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')deny();
 if(!trustedCustodyIssuerPublicKey||typeof expectedCustodyIssuerId!=='string'||
    !ID.test(expectedCustodyIssuerId)||!exact(expected,expectedFields)||
    !Number.isSafeInteger(nowMs)||nowMs<=0||
    !UUID.test(expected.tenantId)||!UUID.test(expected.workerId)||
    !UUID.test(expected.workItemId)||!UUID.test(expected.assignmentId)||
    !ID.test(expected.artifactId)||!ID.test(expected.artifactIssuerId)||
    !ID.test(expected.recipientKeyId)||!SHA.test(expected.envelopeSha256))deny();
 let obj,body;
 try{
  body=new TextDecoder('utf-8',{fatal:true}).decode(dec(encoded,2048));
  obj=JSON.parse(body);
  if(JSON.stringify(obj)!==body||!exact(obj,['claims','signature']))deny();
 }catch{deny()}
 const c=obj.claims;
 if(!exact(c,fields)||c.version!==1||c.issuerId!==expectedCustodyIssuerId||
    c.purpose!=='gaiz2_metadata_preview'||
    !Number.isSafeInteger(c.issuedAtMs)||!Number.isSafeInteger(c.expiresAtMs)||
    c.issuedAtMs<=0||c.issuedAtMs>nowMs||c.expiresAtMs<=nowMs||
    c.expiresAtMs-c.issuedAtMs>30000||
    !expectedFields.every(field=>c[field]===expected[field]))deny();
 const signature=dec(obj.signature,64);
 if(signature.length!==64)deny();
 let publicKey;
 try{
  publicKey=trustedCustodyIssuerPublicKey.type==='public'
   ?trustedCustodyIssuerPublicKey:createPublicKey(trustedCustodyIssuerPublicKey);
  if(publicKey.asymmetricKeyType!=='ed25519'||!edVerify(null,
   Buffer.from('GAIZ2_CUSTODY_GRANT_V1\n'+canonical(c)),publicKey,signature))deny();
 }catch{deny()}
 return Object.freeze({
  ...expected,
  custodyGrantIssuerId:c.issuerId,
  custodyGrantExpiresAtMs:c.expiresAtMs,
  signedCustodyPolicyVerified:true,
  independentKmsAuthorizationRequired:true,
  workloadTransportRequired:true,
  durableAssignmentClaimRequired:true,
  replayControlledGrantRequired:true,
  authorizationGranted:false,
  kmsReleaseAllowed:false,
  importAllowed:false,
 });
}
