// Read-only GAIZ2 signed-envelope verifier. No API route, key custody, decrypt, or tenant authorization.
import {createHash,createPublicKey,verify as verifyEd25519} from 'node:crypto';
const MAGIC=Buffer.from('GAIZ2\n');
const LIMIT=8*1024*1024, MAX_DEPTH=24, MAX_CONTAINER=1024;
const expectedEnvelope=['ciphertext','manifest','nonce','recipients','signature','tag'];
const expectedManifest=['artifactId','contentType','createdAt','issuerId','schemaVersion','tenantScope','version'];
const id=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function deny(){throw Error('Invalid or untrusted GAIZ2 artifact')}
function exact(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join(',')!==keys.slice().sort().join(','))deny()}
function safeUnicode(s){for(let i=0;i<s.length;i++){const u=s.charCodeAt(i);if(u>=0xD800&&u<=0xDBFF){const n=s.charCodeAt(++i);if(!(n>=0xDC00&&n<=0xDFFF))deny()}else if(u>=0xDC00&&u<=0xDFFF)deny()}return s}
function canonical(x,depth=0){if(depth>MAX_DEPTH)deny();if(x===null||typeof x==='boolean')return JSON.stringify(x);if(typeof x==='string')return JSON.stringify(safeUnicode(x));if(typeof x==='number'&&Number.isSafeInteger(x)&&!Object.is(x,-0))return JSON.stringify(x);if(Array.isArray(x)){if(x.length>MAX_CONTAINER)deny();return '['+x.map(v=>canonical(v,depth+1)).join(',')+']'}if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype){const ks=Object.keys(x);if(ks.length>MAX_CONTAINER||ks.some(k=>['__proto__','constructor','prototype'].includes(k)))deny();ks.forEach(safeUnicode);return '{'+ks.sort().map(k=>JSON.stringify(k)+':'+canonical(x[k],depth+1)).join(',')+'}'}deny()}
function decoded(x,max){if(typeof x!=='string'||!/^[A-Za-z0-9_-]+$/.test(x)||x.length>max*2)deny();const b=Buffer.from(x,'base64url');if(b.length>max||b.toString('base64url')!==x)deny();return b}
function parse(blob){
 if(!(blob instanceof Uint8Array)||blob.length<=MAGIC.length||blob.length>LIMIT||!Buffer.from(blob.subarray(0,6)).equals(MAGIC))deny();
 let raw,doc;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(blob.subarray(6));doc=JSON.parse(raw)}catch{deny()}
 if(canonical(doc)!==raw)deny();exact(doc,expectedEnvelope);exact(doc.manifest,expectedManifest);
 const m=doc.manifest;
 if(m.version!==2||m.schemaVersion!==1||m.contentType!=='application/vnd.orgaiz.report+json'||!id.test(m.artifactId)||!id.test(m.issuerId)||!id.test(m.tenantScope))deny();
 if(typeof m.createdAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(m.createdAt)||!Number.isFinite(Date.parse(m.createdAt))||new Date(m.createdAt).toISOString()!==m.createdAt)deny();
 if(decoded(doc.nonce,12).length!==12||decoded(doc.tag,16).length!==16||decoded(doc.signature,64).length!==64)deny();
 decoded(doc.ciphertext,LIMIT);
 if(!Array.isArray(doc.recipients)||doc.recipients.length<1||doc.recipients.length>8)deny();
 const ids=new Set();
 for(const recipient of doc.recipients){exact(recipient,['keyId','wrappedKey']);if(typeof recipient.keyId!=='string'||!id.test(recipient.keyId)||ids.has(recipient.keyId)||decoded(recipient.wrappedKey,1024).length<256)deny();ids.add(recipient.keyId)}
 return doc;
}
/**
 * Public issuer key and expected issuer/tenant MUST come from server-owned policy,
 * not an artifact, browser-supplied text, or a query parameter.
 * Verification never grants authorization or import rights.
 */
export function verifyGaiz2ReadOnly(bytes,{trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope}={}){
 if(!trustedIssuerPublicKey||typeof expectedIssuerId!=='string'||!id.test(expectedIssuerId)||typeof expectedTenantScope!=='string'||!id.test(expectedTenantScope))deny();
 const doc=parse(bytes),m=doc.manifest;
 if(m.issuerId!==expectedIssuerId||m.tenantScope!==expectedTenantScope)deny();
 let issuer,valid=false;
 try{issuer=createPublicKey(trustedIssuerPublicKey);if(issuer.asymmetricKeyType!=='ed25519')deny();
 const unsigned={ciphertext:doc.ciphertext,manifest:m,nonce:doc.nonce,recipients:doc.recipients,tag:doc.tag};
 valid=verifyEd25519(null,Buffer.from('GAIZ2\n'+canonical(unsigned)),issuer,decoded(doc.signature,64));
 }catch{deny()}
 if(!valid)deny();
 return Object.freeze({format:'GAIZ2',manifest:Object.freeze({...m}),sha256:createHash('sha256').update(bytes).digest('hex'),signatureVerified:true,authorizationGranted:false,importAllowed:false});
}
