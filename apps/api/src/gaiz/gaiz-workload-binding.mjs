/**
 * GAIZ worker identity binding, disconnected from all active routes.
 *
 * Call only after a trusted ingress has authenticated the workload (for
 * example mutual TLS) and supplied its immutable service identity. Never
 * derive the workload identity from GAIZ bytes, request headers or token claims.
 * The signed assignment is independently verified by gaiz-worker-assignment.
 *
 * This binds the two already-validated facts; it does not implement mTLS,
 * certify the ingress or grant database permissions.
 */
import { verifyGaizWorkerAssignment } from './gaiz-worker-assignment.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const refuse=()=>{throw new Error('GAIZ workload identity binding denied')};
const purposes=new Set(['gaiz_verify_worker','gaiz_execute_worker']);
const exact=(obj,keys)=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join(',')===keys.slice().sort().join(',');
const signedId=x=>typeof x==='string'&&UUID.test(x);

/**
 * A trusted ingress supplies "workload" from independently verified
 * credentials, and "policy" from server-side assignment issuer config.
 * Workload identity MUST NOT come from a request payload or user context.
 */
export function bindGaizWorkerIdentity(encoded, {
  workload, tenantId, workItemId, purpose,
  trustedIssuerPublicKey, nowMs,
}={}) {
  if(!exact(workload,['workerId','role','credentialIssuer','credentialExpiresAtMs'])||
     !signedId(workload.workerId)||!purposes.has(workload.role)||
     typeof workload.credentialIssuer!=='string'||
     workload.credentialIssuer.length<1||workload.credentialIssuer.length>128||
     !Number.isSafeInteger(workload.credentialExpiresAtMs)||
     !Number.isSafeInteger(nowMs)||nowMs<=0||
     nowMs>=workload.credentialExpiresAtMs||
     !signedId(tenantId)||!signedId(workItemId)||
     !purposes.has(purpose)||workload.role!==purpose)refuse();
  const assignment=verifyGaizWorkerAssignment(encoded,{
    trustedIssuerPublicKey,expectedWorker:workload.workerId,
    expectedTenantId:tenantId,expectedWorkItemId:workItemId,
    expectedPurpose:purpose,nowMs,
  });
  if(assignment.workerId!==workload.workerId||
     assignment.purpose!==workload.role||
     assignment.tenantId!==tenantId||
     assignment.workItemId!==workItemId)refuse();
  return Object.freeze({
    ...assignment,
    // This is a conditional binding of two asserted trusted inputs;
    // it does NOT replace a database single-use claim.
    workloadCredentialIssuer:workload.credentialIssuer,
    workloadCredentialExpiresAtMs:workload.credentialExpiresAtMs,
    importAllowed:false,
    databaseClaimRequired:true,
  });
}
