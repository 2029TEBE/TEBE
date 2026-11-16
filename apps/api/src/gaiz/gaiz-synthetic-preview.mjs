/**
 * Candidate v1 structured-preview adapter. NO HTTP endpoints, no key lookup,
 * no disk persistence, no production support.
 * Caller must be a trusted backend integration, never an upload/browser.
 */
import { createDecipheriv } from 'node:crypto';
import { parseBoundedGaizJson, verifyGaizForPreview } from './gaiz-verifier.mjs';
import { requireGaizOperation } from './gaiz-workflow.mjs';

const deny=()=>{throw new Error('GAIZ preview denied')};
const MAGIC='GAIZ1\n';
const maxPlaintext=1024*1024;
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
  x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);

/**
 * A signed envelope alone is not enough: verify signature+scope first, then
 * AEAD tag with the correctly scoped 32-byte DEK and manifest AAD.
 * The returned structure is JSON only, NEVER executable HTML.
 */
export function previewGaizCandidateSynthetic(bytes, {
  trustedIssuerPublicKey, expectedTenantScope, dataEncryptionKey, context,
}={}) {
  requireGaizOperation(context, 'preview', expectedTenantScope);
  if (!Buffer.isBuffer(dataEncryptionKey) || dataEncryptionKey.length!==32) deny();
  const verified=verifyGaizForPreview(bytes,{trustedIssuerPublicKey,expectedTenantScope});
  if (!verified.verified || verified.importAllowed!==false) deny();
  const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(MAGIC.length));
  const doc=parseBoundedGaizJson(raw);
  const cipher=Buffer.from(doc.ciphertext,'base64url');
  if(cipher.length>maxPlaintext)deny();
  let plaintext;
  try{
    const dec=createDecipheriv('aes-256-gcm',dataEncryptionKey,Buffer.from(doc.nonce,'base64url'));
    dec.setAAD(Buffer.from(canonical(doc.manifest),'utf8'));
    dec.setAuthTag(Buffer.from(doc.tag,'base64url'));
    plaintext=Buffer.concat([dec.update(cipher),dec.final()]);
    if(plaintext.length>maxPlaintext)deny();
  }catch{deny()}
  let content;
  try{
    content=parseBoundedGaizJson(new TextDecoder('utf-8',{fatal:true}).decode(plaintext));
  }catch{deny()}
  // Only inert scalar report fields accepted. Do NOT return arbitrary URLs,
  // HTML, JS, attachments, markdown, CSS or chart definitions.
  if(!content || Array.isArray(content) || typeof content!=='object' ||
    Object.keys(content).some(k=>!['schemaVersion','title','summary'].includes(k)) ||
    content.schemaVersion!==1 ||
    typeof content.title!=='string' || content.title.length>200 ||
    typeof content.summary!=='string' || content.summary.length>5000)deny();
  return Object.freeze({
    artifactId:verified.manifest.artifactId,
    tenantScope:verified.manifest.tenantScope,
    preview:Object.freeze({title:content.title,summary:content.summary}),
    authorizedToImport:false,
    syntheticCandidateOnly:true,
  });
}
