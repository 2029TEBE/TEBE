// Server-side only: selects a UNIQUE currently trusted issuer key from externally provisioned policy.
// Bundle authenticity/custody is the deployer's responsibility; do not accept it in an HTTP body.
import {createPublicKey,createHash} from 'node:crypto';
import {verifyGaiz2ReadOnly} from './gaiz2-readonly-verifier.mjs';
function deny(){throw Error('GAIZ issuer trust unavailable')}
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function selectTrustedGaiz2Issuer({bundle,issuerId,tenantScope,now=new Date()}={}){
 if(!bundle||bundle.version!==1||!Array.isArray(bundle.issuers)||bundle.issuers.length<1||bundle.issuers.length>100||!id(issuerId)||!id(tenantScope)||!(now instanceof Date)||!Number.isFinite(now.getTime()))deny();
 const matching=[];
 for(const entry of bundle.issuers){
  if(!entry||typeof entry!=='object'||!id(entry.issuerId)||!id(entry.keyId)||!hex(entry.spkiSha256)||typeof entry.publicKeyPem!=='string'||!Array.isArray(entry.allowedTenantScopes)||!entry.allowedTenantScopes.every(id)||typeof entry.notBefore!=='string'||typeof entry.notAfter!=='string'||typeof entry.revoked!=='boolean')deny();
  if(entry.issuerId!==issuerId||entry.revoked||!entry.allowedTenantScopes.includes(tenantScope))continue;
  const from=new Date(entry.notBefore),until=new Date(entry.notAfter);
  if(!Number.isFinite(from.getTime())||!Number.isFinite(until.getTime())||from>=until)deny();
  if(now<from||now>=until)continue;
  let publicKey;
  try{publicKey=createPublicKey(entry.publicKeyPem)}catch{deny()}
  if(publicKey.asymmetricKeyType!=='ed25519')deny();
  const fingerprint=createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex');
  if(fingerprint!==entry.spkiSha256)deny();
  matching.push({publicKey,issuerId,tenantScope,keyId:entry.keyId});
 }
 // GAIZ2 does not identify an issuer *key* on the wire. Ambiguous rotations fail closed.
 if(matching.length!==1)deny();
 return Object.freeze(matching[0]);
}
export function verifyGaiz2WithTrustBundle(bytes,{bundle,expectedIssuerId,expectedTenantScope,now}={}){
 const trust=selectTrustedGaiz2Issuer({bundle,issuerId:expectedIssuerId,tenantScope:expectedTenantScope,now});
 const result=verifyGaiz2ReadOnly(bytes,{trustedIssuerPublicKey:trust.publicKey,expectedIssuerId,expectedTenantScope});
 return Object.freeze({...result,issuerKeyId:trust.keyId,authorizationGranted:false,importAllowed:false});
}
