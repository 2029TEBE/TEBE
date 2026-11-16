/**
 * Offline GAIZ workload-credential verifier candidate. No HTTP, database,
 * mTLS, KMS or production registration. Never accept identity flags alone.
 *
 * A credential issuer, independent from the GAIZ assignment issuer, signs an
 * exact canonical assertion bound to a server-generated random challenge.
 * The verifier is fail-closed, but the ingress MUST separately authenticate
 * its transport and atomically consume the challenge to prevent replay.
 */
import {createPublicKey, verify as verifySignature, timingSafeEqual} from 'node:crypto';

const deny=()=>{throw new Error('GAIZ signed workload credential denied')};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PURPOSES=new Set(['gaiz_verify_worker','gaiz_execute_worker']);
const PREFIX='GAIZ_WORKLOAD_CREDENTIAL_V1\n';
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype&&
  Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
const canonical=claims=>'{'+Object.keys(claims).sort().map(k=>JSON.stringify(k)+':'+JSON.stringify(claims[k])).join(',')+'}';
const decode=(s,max)=>{
  if(typeof s!=='string'||s.length===0||s.length>max*2||!/^[A-Za-z0-9_-]+$/.test(s))deny();
  const b=Buffer.from(s,'base64url');
  if(b.length>max||b.toString('base64url')!==s)deny();
  return b;
};
const validId=s=>typeof s==='string'&&UUID.test(s);

/**
 * The caller supplies the expected challenge from backend-controlled ingress,
 * NOT a challenge taken from the signed token or a request field. A separate
 * atomically consumed, expiring nonce ledger is mandatory for production.
 * The trust key must come from a pinned, independently administered directory.
 */
export function verifyGaizSignedWorkloadCredential(encoded,{
  trustedCredentialIssuerPublicKey,expectedIssuerId,expectedWorkerId,
  expectedPurpose,expectedChallenge,nowMs,
}={}){
  if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')deny();
  if(typeof encoded!=='string'||encoded.length>2048||
     !trustedCredentialIssuerPublicKey||
     typeof expectedIssuerId!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(expectedIssuerId)||
     !validId(expectedWorkerId)||!PURPOSES.has(expectedPurpose)||
     !Number.isSafeInteger(nowMs)||nowMs<=0)deny();
  const challenge=decode(expectedChallenge,64);
  if(challenge.length!==32)deny();
  let envelope;
  try{
    const body=new TextDecoder('utf-8',{fatal:true}).decode(decode(encoded,1536));
    envelope=JSON.parse(body);
    if(!exact(envelope,['claims','signature'])||JSON.stringify(envelope)!==body)deny();
  }catch{deny()}
  const claims=envelope.claims;
  if(!exact(claims,['version','issuerId','workerId','role','challenge','issuedAtMs','expiresAtMs'])||
     claims.version!==1||claims.issuerId!==expectedIssuerId||
     claims.workerId!==expectedWorkerId||claims.role!==expectedPurpose||
     !Number.isSafeInteger(claims.issuedAtMs)||!Number.isSafeInteger(claims.expiresAtMs)||
     claims.issuedAtMs<=0||claims.issuedAtMs>nowMs||
     claims.expiresAtMs<=nowMs||
     claims.expiresAtMs-claims.issuedAtMs>60000||
     claims.expiresAtMs<=claims.issuedAtMs)deny();
  const presented=decode(claims.challenge,64);
  if(presented.length!==32||!timingSafeEqual(challenge,presented))deny();
  const signature=decode(envelope.signature,64);
  if(signature.length!==64)deny();
  let trustedKey;
  try{
    trustedKey=trustedCredentialIssuerPublicKey.type==='public'
      ?trustedCredentialIssuerPublicKey
      :createPublicKey(trustedCredentialIssuerPublicKey);
    if(trustedKey.asymmetricKeyType!=='ed25519')deny();
    if(!verifySignature(null,Buffer.from(PREFIX+canonical(claims)),trustedKey,signature))deny();
  }catch{deny()}
  // A signed assertion is NOT proof the presenter controls the workload key.
  // The ingress must authenticate the presenter and consume the challenge.
  return Object.freeze({
    workerId:claims.workerId,
    role:claims.role,
    credentialIssuer:claims.issuerId,
    credentialExpiresAtMs:claims.expiresAtMs,
    independentTransportAuthenticationRequired:true,
    atomicChallengeClaimRequired:true,
    importAllowed:false,
  });
}
