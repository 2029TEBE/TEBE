/**
 * Inactive GAIZ key-custody adapter seam for synthetic interoperability only.
 *
 * No HTTP route, deployed KMS, persisted DEK, export capability, runtime
 * registration or production support. The *backend* must supply a trusted
 * issuer policy and an independently authenticated key custodian.
 *
 * The current GAIZ1 candidate has no recipient-wrapped DEK in its manifest.
 * Therefore this adapter is ONLY a testable migration seam, NOT a secure
 * production unwrapping design.
 */
import { createHash } from 'node:crypto';
import { requireGaizOperation } from './gaiz-workflow.mjs';
import { previewGaizCandidateSynthetic } from './gaiz-synthetic-preview.mjs';

const reject=()=>{throw new Error('GAIZ custody preview denied')};
const validIssuer=x=>typeof x==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(x);
const validBuffer=x=>Buffer.isBuffer(x)&&x.length===32;

/**
 * custodyProvider.releaseSyntheticDek is a backend-owned async interface
 * whose implementation must independently authorize tenant+artifact+purpose.
 * Never accept a provider, trust policy or issuerKeyId from HTTP clients.
 * The returned key is copied and the copy erased in a finally block.
 *
 * The provider is required to return a fresh Buffer whose lifecycle it
 * independently manages. This method never stores or returns key material.
 */
export async function previewGaizWithCustodyCandidate(bytes,{
  expectedTenantScope,issuerKeyId,context,trustPolicy,custodyProvider,
  now=Date.now(),
}={}){
  if(process.env.NODE_ENV==='production'||
     process.env.GAIZ_DEV_ONLY!=='true')reject();
  requireGaizOperation(context,'preview',expectedTenantScope);
  if(!(bytes instanceof Uint8Array)||bytes.length===0||
     bytes.length>8*1024*1024||
     !validIssuer(issuerKeyId)||
     !trustPolicy||typeof trustPolicy.verify!=='function'||
     !custodyProvider||typeof custodyProvider.releaseSyntheticDek!=='function'||
     !Number.isSafeInteger(now)||now<=0)reject();
  const input=Buffer.from(bytes);
  const envelopeSha256=createHash('sha256').update(input).digest('hex');
  // Do not invoke custody until the signature, issuer policy and tenant match.
  const verified=trustPolicy.verify(input,{
    keyId:issuerKeyId,expectedTenantScope,now,
  });
  if(!verified||verified.verified!==true||verified.importAllowed!==false||
     verified.issuerKeyId!==issuerKeyId||
     verified.manifest?.tenantScope!==expectedTenantScope)reject();
  // Provider is not passed any raw file metadata to choose its own tenant.
  let keyCopy;
  try{
    const secret=await custodyProvider.releaseSyntheticDek(Object.freeze({
      tenantId:expectedTenantScope,
      artifactId:verified.manifest.artifactId,
      envelopeSha256,
      issuerKeyId,
      purpose:'synthetic-preview-only',
    }));
    if(!validBuffer(secret))reject();
    keyCopy=Buffer.from(secret);
    const preview=previewGaizCandidateSynthetic(input,{
      trustedIssuerPublicKey:trustPolicy.publicKeyForSyntheticPreview?.(issuerKeyId,{now}),
      expectedTenantScope,dataEncryptionKey:keyCopy,context,
    });
    if(preview.authorizedToImport!==false||
       preview.syntheticCandidateOnly!==true)reject();
    return Object.freeze({
      ...preview,
      issuerKeyId,
      envelopeSha256,
      authorizedToImport:false,
      syntheticCandidateOnly:true,
    });
  }finally{
    keyCopy?.fill(0);
  }
}
