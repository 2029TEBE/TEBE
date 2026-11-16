/**
 * Independent issuer trust policy for the experimental GAIZ1 consumer.
 * No issuer keys are read from untrusted GAIZ envelope bytes.
 * Policy is immutable for each request; rotation/revocation is performed
 * by the backend configuration owner and remains a deployment gate.
 */
import { createPublicKey } from 'node:crypto';
import { verifyGaizForPreview } from './gaiz-verifier.mjs';
const deny=()=>{throw new Error('Untrusted GAIZ issuer')};
const identity=x=>typeof x==='string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(x);

/**
 * Expects a backend-owned array of immutable records:
 * { keyId, publicKey, notBefore, notAfter, revoked }
 * The timestamps must be finite UNIX milliseconds (UTC).
 */
export function createGaizTrustPolicy(entries) {
  if(!Array.isArray(entries) || entries.length===0 || entries.length>32)deny();
  const table=new Map();
  for(const entry of entries){
    if(!entry || !identity(entry.keyId) || table.has(entry.keyId) ||
       !Number.isSafeInteger(entry.notBefore) ||
       !Number.isSafeInteger(entry.notAfter) ||
       entry.notBefore>=entry.notAfter ||
       typeof entry.revoked!=='boolean')deny();
    let publicKey;
    try {
      publicKey=createPublicKey(entry.publicKey);
      if(publicKey.asymmetricKeyType!=='ed25519')deny();
    }catch{deny()}
    table.set(entry.keyId,Object.freeze({
      keyId:entry.keyId,publicKey,notBefore:entry.notBefore,
      notAfter:entry.notAfter,revoked:entry.revoked,
    }));
  }
  return Object.freeze({
    verify(bytes,{keyId,expectedTenantScope,now=Date.now()}={}){
      if(!identity(keyId) || !Number.isSafeInteger(now))deny();
      const issuer=table.get(keyId);
      if(!issuer || issuer.revoked || now<issuer.notBefore || now>=issuer.notAfter)deny();
      const result=verifyGaizForPreview(bytes,{
        trustedIssuerPublicKey:issuer.publicKey,expectedTenantScope,
      });
      return Object.freeze({
        ...result,
        issuerKeyId:keyId,
        importAllowed:false,
      });
    },
    // Backend-only public verification key lookup for inert synthetic preview.
    // This does not expose key custody or authorize recipient DEK release.
    publicKeyForSyntheticPreview(keyId,{now=Date.now()}={}){
      if(!identity(keyId)||!Number.isSafeInteger(now))deny();
      const issuer=table.get(keyId);
      if(!issuer||issuer.revoked||now<issuer.notBefore||now>=issuer.notAfter)deny();
      return issuer.publicKey;
    },
    keyIds(){ return Object.freeze([...table.keys()]); },
  });
}
