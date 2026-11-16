/**
 * Experimental GAIZ worker identity verifier. Never accepts authentication
 * from a user-supplied boolean, request body, or GAIZ file. A backend-issued
 * signed assignment binds ONE worker, tenant and work item to a narrow purpose.
 *
 * The assignment issuer public key MUST come from server-owned deployment
 * configuration; not from the token. Cryptographic validation here is
 * necessary but NOT sufficient: an atomic PostgreSQL claim and independent
 * service credential are still required before any database write.
 *
 * This module signs nothing, holds no private keys, and registers no routes.
 */
import { createPublicKey, verify as verifySignature } from 'node:crypto';

const fail=()=>{throw new Error('GAIZ worker assignment denied')};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const B64=/^[A-Za-z0-9_-]+$/;
const kinds=new Set(['gaiz_verify_worker','gaiz_execute_worker']);
const own=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join(',')===keys.slice().sort().join(',');
const canonical=obj=>'{'+Object.keys(obj).sort().map(k=>
  JSON.stringify(k)+':'+JSON.stringify(obj[k])).join(',')+'}';
const signedPrefix='GAIZ_WORKER_ASSIGNMENT_V1\n';
const nowValid=n=>Number.isSafeInteger(n)&&n>0;

export function verifyGaizWorkerAssignment(encoded, {
  trustedIssuerPublicKey, expectedWorker, expectedTenantId,
  expectedWorkItemId, expectedPurpose, nowMs, maxTtlMs=120000,
}={}) {
  if(typeof encoded!=='string'||encoded.length>2048||!B64.test(encoded)||
    !trustedIssuerPublicKey||!kinds.has(expectedPurpose)||
    !ID.test(expectedTenantId??'')||!ID.test(expectedWorkItemId??'')||
    typeof expectedWorker!=='string'||!ID.test(expectedWorker)||
    !nowValid(nowMs)||!Number.isSafeInteger(maxTtlMs)||
    maxTtlMs<1000||maxTtlMs>120000)fail();
  const token=Buffer.from(encoded,'base64url');
  if(token.toString('base64url')!==encoded||token.length>1536)fail();
  let envelope;
  try {
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(token);
    envelope=JSON.parse(raw);
  }catch{fail()}
  if(!own(envelope,['claims','signature'])||
    !own(envelope.claims,['version','workerId','tenantId','workItemId',
      'purpose','issuedAtMs','expiresAtMs','assignmentId'])||
    envelope.claims.version!==1||
    envelope.claims.workerId!==expectedWorker||
    envelope.claims.tenantId!==expectedTenantId||
    envelope.claims.workItemId!==expectedWorkItemId||
    envelope.claims.purpose!==expectedPurpose||
    !ID.test(envelope.claims.assignmentId??'')||
    !nowValid(envelope.claims.issuedAtMs)||
    !nowValid(envelope.claims.expiresAtMs)||
    envelope.claims.issuedAtMs>nowMs||
    nowMs>=envelope.claims.expiresAtMs||
    envelope.claims.expiresAtMs<=envelope.claims.issuedAtMs||
    envelope.claims.expiresAtMs-envelope.claims.issuedAtMs>maxTtlMs||
    typeof envelope.signature!=='string'||!B64.test(envelope.signature))fail();
  const sig=Buffer.from(envelope.signature,'base64url');
  if(sig.length!==64||sig.toString('base64url')!==envelope.signature)fail();
  let key;
  try {
    key=trustedIssuerPublicKey.type==='public'?
      trustedIssuerPublicKey:createPublicKey(trustedIssuerPublicKey);
    if(key.asymmetricKeyType!=='ed25519')fail();
  }catch{fail()}
  const message=Buffer.from(signedPrefix+canonical(envelope.claims),'utf8');
  let authentic=false;
  try {authentic=verifySignature(null,message,key,sig)}catch{fail()}
  if(!authentic)fail();
  // Assignment ID is for a database-enforced single-use claim; the verifier
  // does not mark it spent and cannot authorize an import on its own.
  return Object.freeze({
    assignmentId:envelope.claims.assignmentId,
    workerId:envelope.claims.workerId,
    tenantId:envelope.claims.tenantId,
    workItemId:envelope.claims.workItemId,
    purpose:envelope.claims.purpose,
    expiresAtMs:envelope.claims.expiresAtMs,
    authenticatedAssignment:true,
    databaseClaimRequired:true,
    importAllowed:false,
  });
}
