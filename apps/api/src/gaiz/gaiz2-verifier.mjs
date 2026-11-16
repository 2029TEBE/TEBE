/**
 * Independent TEBE consumer for TO's experimental GAIZ2 wire format.
 * Verify-only, NO key release, no import approval, no database or HTTP route.
 * This is intentionally separate from the GAIZ1 verifier: never auto-convert.
 *
 * Candidate producer: TO gaiz/v2.mjs, PR #30.
 */
import { createHash, createPublicKey, verify as edVerify } from 'node:crypto';
const MAGIC='GAIZ2\n',MAX=8*1024*1024;
const deny=()=>{throw Error('Invalid or untrusted GAIZ2 artifact')};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype&&
  Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
function canonical(x,depth=0){
  if(depth>24)deny();
  if(x===null||typeof x==='boolean')return JSON.stringify(x);
  if(typeof x==='string'){
    for(let i=0;i<x.length;i++){
      const n=x.charCodeAt(i);
      if(n>=0xd800&&n<=0xdbff){
        const next=x.charCodeAt(++i);
        if(!(next>=0xdc00&&next<=0xdfff))deny();
      }else if(n>=0xdc00&&n<=0xdfff)deny();
    }
    return JSON.stringify(x);
  }
  if(typeof x==='number'){
    if(!Number.isSafeInteger(x)||Object.is(x,-0))deny();
    return JSON.stringify(x);
  }
  if(Array.isArray(x)){
    if(x.length>1024)deny();
    return '['+x.map(y=>canonical(y,depth+1)).join(',')+']';
  }
  if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype){
    const keys=Object.keys(x);
    if(keys.length>1024||keys.some(k=>['__proto__','constructor','prototype'].includes(k)))deny();
    return '{'+keys.sort().map(k=>canonical(k)+':'+canonical(x[k],depth+1)).join(',')+'}';
  }
  deny();
}
const decode=(x,max)=>{
  if(typeof x!=='string'||x.length===0||x.length>max*2||
     !/^[A-Za-z0-9_-]+$/.test(x))deny();
  const b=Buffer.from(x,'base64url');
  if(b.length>max||b.toString('base64url')!==x)deny();
  return b;
};
export function verifyGaiz2ForQuarantine(bytes,{
  trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope,
}={}){
  if(!(bytes instanceof Uint8Array)||bytes.length>MAX||
     !id(expectedIssuerId)||!id(expectedTenantScope)||
     !trustedIssuerPublicKey)deny();
  const raw=Buffer.from(bytes);
  if(!raw.subarray(0,MAGIC.length).equals(Buffer.from(MAGIC)))deny();
  let body,doc;
  try{
    body=new TextDecoder('utf-8',{fatal:true}).decode(raw.subarray(MAGIC.length));
    doc=JSON.parse(body);
    if(canonical(doc)!==body)deny();
  }catch{deny()}
  if(!exact(doc,['ciphertext','manifest','nonce','recipients','signature','tag'])||
     !exact(doc.manifest,['artifactId','contentType','createdAt','issuerId','schemaVersion','tenantScope','version']))deny();
  const m=doc.manifest;
  if(m.version!==2||m.schemaVersion!==1||
     m.contentType!=='application/vnd.orgaiz.report+json'||
     !id(m.artifactId)||m.issuerId!==expectedIssuerId||
     m.tenantScope!==expectedTenantScope||
     typeof m.createdAt!=='string'||
     !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(m.createdAt)||
     !Number.isFinite(Date.parse(m.createdAt))||
     new Date(m.createdAt).toISOString()!==m.createdAt)deny();
  if(decode(doc.nonce,12).length!==12||decode(doc.tag,16).length!==16||
     decode(doc.signature,64).length!==64)deny();
  decode(doc.ciphertext,MAX);
  if(!Array.isArray(doc.recipients)||doc.recipients.length<1||
     doc.recipients.length>8)deny();
  let previous='';
  for(const r of doc.recipients){
    if(!exact(r,['keyId','wrappedKey'])||!id(r.keyId)||
       (previous!==''&&r.keyId<=previous)||
       decode(r.wrappedKey,1024).length<256)deny();
    previous=r.keyId;
  }
  let key;
  try{
    key=trustedIssuerPublicKey.type==='public'?
      trustedIssuerPublicKey:createPublicKey(trustedIssuerPublicKey);
    if(key.asymmetricKeyType!=='ed25519')deny();
  }catch{deny()}
  const unsigned={ciphertext:doc.ciphertext,manifest:m,nonce:doc.nonce,
    recipients:doc.recipients,tag:doc.tag};
  const signed=Buffer.from(MAGIC+canonical(unsigned),'utf8');
  if(!edVerify(null,signed,key,decode(doc.signature,64)))deny();
  // Verification does not grant recipient access, decryption or import rights.
  return Object.freeze({
    format:'GAIZ2',artifactId:m.artifactId,tenantScope:m.tenantScope,
    issuerId:m.issuerId,
    envelopeSha256:createHash('sha256').update(raw).digest('hex'),
    signatureVerified:true,authorizationGranted:false,importAllowed:false,
    recipientCount:doc.recipients.length,
  });
}


/**
 * Only expose signed ciphertext metadata for ONE backend-selected recipient.
 * The descriptor is NOT authorization. The key custodian must independently
 * enforce entitlement, workload identity, tenant and key scope.
 */
export function verifyGaiz2RecipientForCustody(bytes,{
  trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope,recipientKeyId,
}={}){
  if(!id(recipientKeyId))deny();
  const input=Buffer.from(bytes??[]);
  const receipt=verifyGaiz2ForQuarantine(input,{
    trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope,
  });
  // Re-parse only AFTER the exact raw bytes passed canonical/signature checks.
  const doc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(
    input.subarray(MAGIC.length)));
  const found=doc.recipients.find(r=>r.keyId===recipientKeyId);
  if(!found)deny();
  return Object.freeze({
    ...receipt,
    recipientKeyId,
    // Opaque RSA-OAEP ciphertext, not a DEK and not sufficient to unwrap.
    wrappedKey:found.wrappedKey,
    // Ciphertext and manifest stay in the verifier process for AEAD preview.
    manifest:Object.freeze({...doc.manifest}),
    nonce:doc.nonce,
    tag:doc.tag,
    ciphertext:doc.ciphertext,
    authorizationGranted:false,importAllowed:false,
  });
}
