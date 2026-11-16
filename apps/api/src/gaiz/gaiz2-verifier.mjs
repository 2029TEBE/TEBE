// GAIZ2 read-only draft verification adapter. No enterprise import, decryption or issuer registry.
// Cross-repository development contract: TO gaiz/CONTRACT-v2.md (not a frozen release).
import {verify as verifySignature, createPublicKey, createHash} from 'node:crypto';
const MAGIC=Buffer.from('GAIZ2\n','ascii');
const MAX=8*1024*1024;
function canon(v,depth=0){
 if(depth>24)throw Error('GAIZ nesting limit');
 if(v===null||typeof v==='boolean')return JSON.stringify(v);
 if(typeof v==='string'){for(let i=0;i<v.length;i++){const u=v.charCodeAt(i);if(u>=0xD800&&u<=0xDBFF){const next=v.charCodeAt(++i);if(!(next>=0xDC00&&next<=0xDFFF))throw Error('Invalid Unicode');}else if(u>=0xDC00&&u<=0xDFFF)throw Error('Invalid Unicode');}return JSON.stringify(v);}
 if(typeof v==='number'&&Number.isSafeInteger(v)&&!Object.is(v,-0))return JSON.stringify(v);
 if(Array.isArray(v)){if(v.length>1024)throw Error('GAIZ item limit');return '['+v.map(x=>canon(x,depth+1)).join(',')+']';}
 if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype){
  const keys=Object.keys(v);if(keys.length>1024||keys.some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error('GAIZ keys rejected');
  return '{'+keys.sort().map(k=>canon(k)+':'+canon(v[k],depth+1)).join(',')+'}';
 }
 throw Error('Unsupported GAIZ JSON');
}
function fields(obj,expected){
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).sort().join('|')!==expected.slice().sort().join('|'))throw Error('GAIZ fields rejected');
}
function binary(s,max){
 if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s)||s.length>max*2)throw Error('Invalid encoded field');
 const b=Buffer.from(s,'base64url');
 if(b.length>max||b.toString('base64url')!==s)throw Error('Noncanonical encoded field');
 return b;
}
function ident(s){return typeof s==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(s);}
export function verifyGaiz2ForPreview(input,{trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope}={}){
 if(!trustedIssuerPublicKey||!ident(expectedIssuerId)||!ident(expectedTenantScope))throw Error('Trusted issuer and tenant policy required');
 const data=Buffer.from(input);
 if(data.length>MAX||data.length<=MAGIC.length||!data.subarray(0,MAGIC.length).equals(MAGIC))throw Error('Invalid GAIZ2 header or size');
 const raw=new TextDecoder('utf-8',{fatal:true}).decode(data.subarray(MAGIC.length));
 const doc=JSON.parse(raw);
 if(canon(doc)!==raw)throw Error('Noncanonical GAIZ2 envelope');
 fields(doc,['ciphertext','manifest','nonce','recipients','signature','tag']);
 fields(doc.manifest,['artifactId','contentType','createdAt','issuerId','schemaVersion','tenantScope','version']);
 const m=doc.manifest;
 if(m.version!==2||m.schemaVersion!==1||m.contentType!=='application/vnd.orgaiz.report+json'||!ident(m.artifactId)||!ident(m.issuerId)||!ident(m.tenantScope))throw Error('Unsupported GAIZ2 manifest');
 if(typeof m.createdAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\\.\d{3}Z$/.test(m.createdAt)||!Number.isFinite(Date.parse(m.createdAt))||new Date(m.createdAt).toISOString()!==m.createdAt)throw Error('Invalid timestamp');
 if(binary(doc.nonce,12).length!==12||binary(doc.tag,16).length!==16||binary(doc.signature,64).length!==64)throw Error('Invalid GAIZ2 cryptographic field length');
 binary(doc.ciphertext,MAX);
 if(!Array.isArray(doc.recipients)||doc.recipients.length<1||doc.recipients.length>8)throw Error('Invalid GAIZ2 recipient count');
 const seen=new Set();
 for(const recipient of doc.recipients){
  fields(recipient,['keyId','wrappedKey']);
  if(!ident(recipient.keyId)||seen.has(recipient.keyId)||binary(recipient.wrappedKey,1024).length<256)throw Error('Invalid recipient envelope');
  seen.add(recipient.keyId);
 }
 if(m.issuerId!==expectedIssuerId)throw Error('Issuer denied');
 if(m.tenantScope!==expectedTenantScope)throw Error('Tenant denied');
 const trusted=trustedIssuerPublicKey?.type==='public'?trustedIssuerPublicKey:createPublicKey(trustedIssuerPublicKey);
 const toVerify=Buffer.from('GAIZ2\n'+canon({ciphertext:doc.ciphertext,manifest:m,nonce:doc.nonce,recipients:doc.recipients,tag:doc.tag}),'utf8');
 if(trusted.asymmetricKeyType!=='ed25519'||!verifySignature(null,toVerify,trusted,binary(doc.signature,64)))throw Error('Invalid GAIZ2 issuer signature');
 return Object.freeze({verified:true,format:'GAIZ2',artifactId:m.artifactId,issuerId:m.issuerId,tenantScope:m.tenantScope,sha256:createHash('sha256').update(data).digest('hex'),authorizationGranted:false,importAllowed:false});
}
