// Independent TO GAIZ2 local-custodian attestation *metadata* verifier.
// Deliberately not a decryption or import authorization endpoint.
import {verify,createPublicKey} from 'node:crypto';
const DOMAIN='GAIZ2-CUSTODY-RECEIPT\n';
const HASH=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function payloadBytes(r) {
 if(!r||typeof r!=='object'||Array.isArray(r))throw Error('Invalid custody receipt');
 const fields=['artifactId','artifactSha256','keyId','recipientTenant','reportSha256','reviewId','timestamp','validation'];
 if(Object.keys(r).sort().join('|')!==fields.sort().join('|'))throw Error('Unexpected receipt fields');
 for(const k of ['artifactId','keyId','recipientTenant','reviewId'])
   if(typeof r[k]!=='string'||!ID.test(r[k]))throw Error('Invalid identity');
 if(typeof r.artifactSha256!=='string'||!HASH.test(r.artifactSha256)||
    typeof r.reportSha256!=='string'||!HASH.test(r.reportSha256)||
    r.validation!=='schema-validated-no-import')throw Error('Invalid receipt claims');
 const epoch=Date.parse(r.timestamp);
 if(typeof r.timestamp!=='string'||!Number.isFinite(epoch)||new Date(epoch).toISOString()!==r.timestamp)throw Error('Invalid timestamp');
 return Buffer.from(DOMAIN+JSON.stringify(Object.fromEntries(Object.keys(r).sort().map(k=>[k,r[k]]))));
}
export function verifyCustodianAttestation(receipt,{
 trustedCustodianPublicKey,tenantId,expectedArtifactSha256,expectedReviewId,now=Date.now(),
}={}){
 if(!trustedCustodianPublicKey||typeof receipt?.signature!=='string')throw Error('Trusted signer missing');
 const key=trustedCustodianPublicKey?.type==='public'?trustedCustodianPublicKey:createPublicKey(trustedCustodianPublicKey);
 if(key.asymmetricKeyType!=='ed25519')throw Error('Custodian signer algorithm denied');
 const sig=Buffer.from(receipt.signature,'base64url');
 if(sig.length!==64||sig.toString('base64url')!==receipt.signature||
    !verify(null,payloadBytes(receipt.payload),key,sig))throw Error('Custodian signature invalid');
 const r=receipt.payload;
 if(r.recipientTenant!==tenantId||r.artifactSha256!==expectedArtifactSha256||r.reviewId!==expectedReviewId)
   throw Error('Custodian receipt not authorized for tenant/review');
 const age=now-Date.parse(r.timestamp);
 if(age<0||age>300000)throw Error('Custodian receipt stale');
 return Object.freeze({cryptographicAttestationVerified:true,artifactSha256:r.artifactSha256,
  reportSha256:r.reportSha256,importAllowed:false,decryptAllowed:false,plaintextReleased:false});
}
