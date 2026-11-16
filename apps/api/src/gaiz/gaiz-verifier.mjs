// Read-only GAIZ v1 verification adapter. No database writes or decryption-key custody.
import {verify as verifySignature} from 'node:crypto';
const MAGIC='GAIZ1\n', LIMIT=8*1024*1024;
const fail=()=>{throw Error('Invalid or untrusted GAIZ artifact')};
function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  if(value===null || ['string','boolean','number'].includes(typeof value))return JSON.stringify(value);
  throw Error('Invalid manifest value');
}

/** Strict, bounded JSON scanner: JSON.parse alone accepts duplicate keys. */
function parseBounded(raw) {
  let i=0, count=0;
  const space=()=>{while(i<raw.length && /[\x20\t\r\n]/.test(raw[i]))i++};
  function str() {
    const start=i;
    if(raw[i++]!=='"')fail();
    while(i<raw.length) {
      const c=raw[i++];
      if(c==='"') {
        if(i-start>131072)fail();
        let v; try{v=JSON.parse(raw.slice(start,i))}catch{fail()}
        if(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v))fail();
        return v;
      }
      if(c==='\\') {
        const e=raw[i++];
        if(e==='u') {
          if(!/^[0-9a-fA-F]{4}$/.test(raw.slice(i,i+4)))fail();
          i+=4;
        } else if(!'"\\/bfnrt'.includes(e??'\0'))fail();
      } else if(c.charCodeAt(0)<32)fail();
    }
    fail();
  }
  function read(depth) {
    if(depth>16)fail();
    space();
    if(raw[i]==='"')return str();
    if(raw[i]==='{') {
      i++; space(); const obj=Object.create(null), keys=new Set();
      if(raw[i]==='}') {i++;return obj}
      while(true) {
        space(); const key=str();
        if(keys.has(key)||++count>64)fail();
        keys.add(key);space();if(raw[i++]!==':')fail();
        obj[key]=read(depth+1);space();
        if(raw[i]==='}') {i++;return obj}
        if(raw[i++]!==',')fail();
      }
    }
    if(raw[i]==='[') {
      i++;space();const a=[];
      if(raw[i]===']'){i++;return a}
      while(true) {
        if(++count>64)fail();
        a.push(read(depth+1));space();
        if(raw[i]===']'){i++;return a}
        if(raw[i++]!==',')fail();
      }
    }
    const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(raw.slice(i));
    if(!m)fail();
    i+=m[0].length;
    const v=JSON.parse(m[0]);
    if(typeof v==='number'&&!Number.isSafeInteger(v))fail();
    return v;
  }
  const parsed=read(0);space();if(i!==raw.length)fail();
  return parsed;
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
  if(!(Buffer.isBuffer(bytes)||bytes instanceof Uint8Array))fail();
  const input=Buffer.from(bytes);
  if(!trustedIssuerPublicKey || !expectedTenantScope)throw Error('Missing trusted verification policy');
  if(input.length>LIMIT || !input.subarray(0,MAGIC.length).equals(Buffer.from(MAGIC)))throw Error('Invalid GAIZ header or bounds');
  let raw;
  try{raw=new TextDecoder('utf-8',{fatal:true}).decode(input.subarray(MAGIC.length))}catch{fail()}
  const doc=parseBounded(raw);
  if(!doc || Array.isArray(doc) || typeof doc!=='object' || Object.keys(doc).sort().join(',')!=='ciphertext,manifest,nonce,signature,tag' ||
     Array.isArray(doc.manifest) || Object.keys(doc.manifest).sort().join(',')!=='artifactId,tenantScope,version' ||
     !doc.manifest || doc.manifest.version!==1 || typeof doc.manifest.artifactId!=='string' || !doc.manifest.artifactId || doc.manifest.artifactId.length>256 ||
     typeof doc.manifest.tenantScope!=='string' || !doc.manifest.tenantScope || doc.manifest.tenantScope.length>256 ||
     binary(doc.nonce).length!==12 || binary(doc.tag).length!==16 || binary(doc.signature).length!==64 || binary(doc.ciphertext).length>LIMIT)throw Error('Invalid GAIZ structure');
  const data=Buffer.from(MAGIC+canonical({manifest:doc.manifest,nonce:doc.nonce,tag:doc.tag,ciphertext:doc.ciphertext}));
  if(!verifySignature(null,data,trustedIssuerPublicKey,binary(doc.signature)))throw Error('Untrusted GAIZ signature');
  if(doc.manifest.tenantScope!==expectedTenantScope)throw Error('Tenant mismatch');
  return Object.freeze({verified:true,manifest:Object.freeze({...doc.manifest}),importAllowed:false});
}
