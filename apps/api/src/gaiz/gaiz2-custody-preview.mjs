/**
 * GAIZ2 recipient-custody preview: disconnected development-only adapter.
 *
 * The producer's Ed25519 signature authenticates the entire recipient list.
 * A separately authenticated custodian must authorize the selected tenant,
 * artifact, signed digest, service identity and recipient key BEFORE unwrap.
 * Merely providing a provider object never proves authentication.
 *
 * No live route, worker registration, KMS connection or import capability.
 */
import { createDecipheriv } from 'node:crypto';
import { requireGaizOperation } from './gaiz-workflow.mjs';
import { verifyGaiz2RecipientForCustody } from './gaiz2-verifier.mjs';

const deny=()=>{throw Error('GAIZ2 recipient custody denied')};
const decode=(s,max)=>{
  if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s)||s.length>max*2)deny();
  const b=Buffer.from(s,'base64url');
  if(b.length>max||b.toString('base64url')!==s)deny();
  return b;
};
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
  x&&typeof x==='object'?
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
  JSON.stringify(x);

/**
 * All options are injected by trusted backend code. Neither the provider
 * nor the issuer key may be supplied by HTTP clients, GAIZ file or AI agent.
 * The custodian must do its OWN authorization; this method never grants one.
 */
export async function previewGaiz2CustodyCandidate(bytes,{
  context,expectedTenantScope,expectedIssuerId,trustedIssuerPublicKey,
  recipientKeyId,custodyProvider,
}={}){
  if(process.env.NODE_ENV==='production'||
     process.env.GAIZ_DEV_ONLY!=='true')deny();
  requireGaizOperation(context,'preview',expectedTenantScope);
  if(!custodyProvider||typeof custodyProvider.unwrapSyntheticRecipientDek!=='function')deny();
  const signed=verifyGaiz2RecipientForCustody(bytes,{
    expectedTenantScope,expectedIssuerId,trustedIssuerPublicKey,recipientKeyId,
  });
  // Only authenticated signed bytes and server-chosen scope may reach custody.
  const request=Object.freeze({
    tenantId:expectedTenantScope,
    artifactId:signed.artifactId,
    issuerId:signed.issuerId,
    envelopeSha256:signed.envelopeSha256,
    recipientKeyId,
    wrappedKey:signed.wrappedKey,
    algorithm:'RSA-OAEP-SHA256',
    purpose:'synthetic-preview-only',
  });
  let dek,plaintext;
  try{
    const secret=await custodyProvider.unwrapSyntheticRecipientDek(request);
    if(!Buffer.isBuffer(secret)||secret.length!==32)deny();
    dek=Buffer.from(secret); // erase only the adapter-owned copy
    const cipher=decode(signed.ciphertext,8*1024*1024);
    const dec=createDecipheriv('aes-256-gcm',dek,decode(signed.nonce,12));
    dec.setAAD(Buffer.from(canonical(signed.manifest)));
    dec.setAuthTag(decode(signed.tag,16));
    plaintext=Buffer.concat([dec.update(cipher),dec.final()]);
    if(plaintext.length>1024*1024)deny();
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(plaintext);
    let report=JSON.parse(raw);
    if(canonical(report)!==raw||
       !report||Array.isArray(report)||typeof report!=='object'||
       typeof report.title!=='string'||report.title.length<1||
       report.title.length>200||/[<>\x00-\x1f]/.test(report.title))deny();
    // A strictly inert title-only preview; no raw arbitrary fields,
    // attachments, HTML, code, source URLs or key bytes are returned.
    const title=report.title;
    report=null;
    return Object.freeze({
      format:'GAIZ2',artifactId:signed.artifactId,
      issuerId:signed.issuerId,tenantScope:expectedTenantScope,
      envelopeSha256:signed.envelopeSha256,
      preview:Object.freeze({title}),
      authorizationGranted:false,importAllowed:false,
      syntheticCandidateOnly:true,
    });
  }catch{deny()}finally{
    plaintext?.fill(0);
    dek?.fill(0);
  }
}
