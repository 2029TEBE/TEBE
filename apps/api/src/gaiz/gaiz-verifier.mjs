// Read-only GAIZ v1 verification adapter. No database writes or decryption-key custody.
import {verify as verifySignature} from 'node:crypto';
const MAGIC='GAIZ1\n', LIMIT=8*1024*1024;
function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  if(value===null || ['string','boolean','number'].includes(typeof value))return JSON.stringify(value);
  throw Error('Invalid manifest value');
}
function binary(s) {
  if(typeof s!=='string'|| !/^[A-Za-z0-9_-]+$/.test(s) || s.length>LIMIT*2) throw Error('Invalid base64url');
  const b=Buffer.from(s,'base64url');
  if(b.toString('base64url')!==s)throw Error('Noncanonical base64url');
  return b;
}
/** Trust publicKey via backend policy, NOT from the file or HTTP caller.
 * Tenant access and authorization remain additional requirements. */
export function verifyGaizForPreview(bytes, {trustedIssuerPublicKey, expectedTenantScope}) {
  const input=Buffer.from(bytes);
  if(!trustedIssuerPublicKey || !expectedTenantScope)throw Error('Missing trusted verification policy');
  if(input.length>LIMIT || !input.subarray(0,MAGIC.length).equals(Buffer.from(MAGIC)))throw Error('Invalid GAIZ header or bounds');
  const doc=JSON.parse(input.subarray(MAGIC.length).toString('utf8'));
  if(!doc || Object.keys(doc).sort().join(',')!=='ciphertext,manifest,nonce,signature,tag' ||
     !doc.manifest || doc.manifest.version!==1 || typeof doc.manifest.artifactId!=='string' || !doc.manifest.artifactId ||
     typeof doc.manifest.tenantScope!=='string' || !doc.manifest.tenantScope ||
     binary(doc.nonce).length!==12 || binary(doc.tag).length!==16 || binary(doc.signature).length!==64)throw Error('Invalid GAIZ structure');
  const data=Buffer.from(MAGIC+canonical({manifest:doc.manifest,nonce:doc.nonce,tag:doc.tag,ciphertext:doc.ciphertext}));
  if(!verifySignature(null,data,trustedIssuerPublicKey,binary(doc.signature)))throw Error('Untrusted GAIZ signature');
  if(doc.manifest.tenantScope!==expectedTenantScope)throw Error('Tenant mismatch');
  return Object.freeze({verified:true,manifest:Object.freeze({...doc.manifest}),importAllowed:false});
}
