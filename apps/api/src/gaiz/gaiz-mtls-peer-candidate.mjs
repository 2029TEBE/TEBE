/**
 * Disconnected DEVELOPMENT-ONLY mTLS peer identity candidate.
 *
 * Called ONLY on Node tls.createServer()'s 'secureConnection' event, with
 * requestCert:true, rejectUnauthorized:true, minVersion:'TLSv1.3', and a
 * separately provisioned CA trust store. Do not accept socket substitutes,
 * HTTP headers, a request body, or a client-supplied policy registry.
 *
 * TLS authorization alone is not enough: pin the exact client certificate
 * fingerprint to a backend-owned, independently reviewed worker registry.
 * This code neither provisions TLS nor creates server routes or KMS access.
 */
import {TLSSocket} from 'node:tls';
import {X509Certificate, createHash, timingSafeEqual} from 'node:crypto';

const deny=()=>{throw Error('GAIZ mTLS peer identity denied')};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES=new Set(['gaiz_verify_worker','gaiz_execute_worker']);
const FINGERPRINT=/^[0-9a-f]{64}$/;
const exact=(x,fields)=>x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).sort().join(',')===fields.slice().sort().join(',');
const matchingDigest=(a,b)=>{
  if(!FINGERPRINT.test(a)||!FINGERPRINT.test(b))return false;
  return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
};

/**
 * `trustedPeers` MUST be a backend-owned Map keyed by lowercase SHA-256
 * certificate fingerprint. Entries are configured independently from TLS
 * traffic, with explicit validity and revocation. A Map is not proof of
 * provenance; its ownership must be controlled by the trusted ingress.
 */
export function verifyGaizMtlsPeerCandidate(socket,{trustedPeers,nowMs}={}){
  if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')deny();
  if(!(socket instanceof TLSSocket)||socket.destroyed||
     socket.encrypted!==true||socket.authorized!==true||
     socket.authorizationError||
     socket.getProtocol?.()!=='TLSv1.3'||
     !(trustedPeers instanceof Map)||
     !Number.isSafeInteger(nowMs)||nowMs<=0)deny();
  let raw;
  try{raw=socket.getPeerCertificate(true)?.raw}catch{deny()}
  if(!Buffer.isBuffer(raw)||raw.length<128||raw.length>16384)deny();
  let certificate;
  try{certificate=new X509Certificate(raw)}catch{deny()}
  const fingerprint=createHash('sha256').update(raw).digest('hex');
  const entry=trustedPeers.get(fingerprint);
  if(!exact(entry,['workerId','role','credentialIssuer','notBeforeMs','expiresAtMs','revoked'])||
     !UUID.test(entry.workerId)||!ROLES.has(entry.role)||
     typeof entry.credentialIssuer!=='string'||
     !/^[A-Za-z0-9._:-]{1,128}$/.test(entry.credentialIssuer)||
     !Number.isSafeInteger(entry.notBeforeMs)||
     !Number.isSafeInteger(entry.expiresAtMs)||
     entry.notBeforeMs>=entry.expiresAtMs||
     entry.revoked!==false||
     nowMs<entry.notBeforeMs||nowMs>=entry.expiresAtMs)deny();
  // Reject a registry alias/malformed fingerprint; the certificate itself
  // remains the canonical identity from Node's verified TLS socket.
  if(!matchingDigest(fingerprint,certificate.fingerprint256.replaceAll(':','').toLowerCase()))deny();
  const from=Date.parse(certificate.validFrom),until=Date.parse(certificate.validTo);
  if(!Number.isFinite(from)||!Number.isFinite(until)||
     nowMs<from||nowMs>=until)deny();
  return Object.freeze({
    workerId:entry.workerId,
    role:entry.role,
    credentialIssuer:entry.credentialIssuer,
    credentialExpiresAtMs:Math.min(entry.expiresAtMs,until),
    certificateSha256:fingerprint,
    // These remain unmet: certificate possession alone does not establish
    // assignment integrity, challenge single-use, tenant rights or KMS access.
    signedAssignmentRequired:true,
    atomicChallengeClaimRequired:true,
    databaseClaimRequired:true,
    custodyAuthorizationRequired:true,
    authorizationGranted:false,
    importAllowed:false,
  });
}
