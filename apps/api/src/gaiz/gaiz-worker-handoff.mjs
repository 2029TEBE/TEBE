/**
 * GAIZ v1 isolated-worker handoff policy (pure candidate, no database access).
 *
 * This module checks the shape of BACKEND-OWNED evidence before a verifier
 * or executor transaction is attempted. It is not an authentication provider:
 * do not pass HTTP fields, artifact claims or arbitrary queue JSON as evidence.
 * Real worker identity, RLS, immutable storage and transaction atomicity must
 * be enforced separately by infrastructure and PostgreSQL.
 */
import { timingSafeEqual } from 'node:crypto';

const deny=()=>{throw new Error('GAIZ worker handoff denied')};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const validUuid=x=>typeof x==='string'&&UUID.test(x);
const validHash=x=>typeof x==='string'&&SHA.test(x);
const eq=(a,b)=>validHash(a)&&validHash(b)&&
  timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const exactKeys=(obj,keys)=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join('|')===keys.slice().sort().join('|');
const isTrue=x=>x===true;
const epoch=x=>Number.isSafeInteger(x)&&x>=0;

/**
 * A verifier may only submit a prepared claim associated with the exact
 * quarantined bytes and the same authenticated tenant as its assigned work.
 * This does NOT perform signature, AEAD, key-distribution or SQL checks.
 */
export function authorizeGaizVerifyHandoff(task,principal,evidence) {
  if(!exactKeys(principal,['kind','tenantId','authenticated','workItemId'])||
     principal.kind!=='gaiz_verify_worker'||!isTrue(principal.authenticated)||
     !validUuid(principal.tenantId)||!validUuid(principal.workItemId)||
     !exactKeys(task,['tenantId','quarantineId','sha256','state','revision'])||
     task.tenantId!==principal.tenantId||
     task.quarantineId!==principal.workItemId||
     task.state!=='quarantined'||!Number.isSafeInteger(task.revision)||task.revision<0||
     !exactKeys(evidence,['tenantId','quarantineId','sha256','signatureVerified','aeadVerified','schemaVersion'])||
     evidence.tenantId!==principal.tenantId||
     evidence.quarantineId!==task.quarantineId||
     !eq(task.sha256,evidence.sha256)||
     !isTrue(evidence.signatureVerified)||!isTrue(evidence.aeadVerified)||
     evidence.schemaVersion!==1)deny();
  return Object.freeze({tenantId:task.tenantId,quarantineId:task.quarantineId,
    expectedRevision:task.revision,sha256:task.sha256,
    nextState:'verified',importAllowed:false});
}

/**
 * Approval is a persisted independent human decision, not a boolean from a
 * file or a caller. Return only an inert transaction plan; the worker must
 * lock the job and enforce the receipt UNIQUE constraint in PostgreSQL.
 */
export function authorizeGaizExecuteHandoff(job,principal,approval,evidence,now) {
  if(!exactKeys(principal,['kind','tenantId','authenticated','userId','workItemId'])||
     principal.kind!=='gaiz_execute_worker'||!isTrue(principal.authenticated)||
     !validUuid(principal.tenantId)||!validUuid(principal.userId)||!validUuid(principal.workItemId)||
     !exactKeys(job,['id','tenantId','state','revision','requestedBy','approvedBy','sha256','mappingSha256'])||
     !validUuid(job.id)||job.id!==principal.workItemId||
     job.tenantId!==principal.tenantId||
     job.state!=='approved'||!Number.isSafeInteger(job.revision)||job.revision<0||
     !validUuid(job.requestedBy)||!validUuid(job.approvedBy)||
     job.requestedBy===job.approvedBy||principal.userId===job.approvedBy||
     !exactKeys(approval,['tenantId','jobId','actorId','outcome','decidedAtMs','revision'])||
     approval.tenantId!==job.tenantId||approval.jobId!==job.id||
     approval.actorId!==job.approvedBy||approval.outcome!=='approved'||
     approval.revision!==job.revision-1||
     !epoch(approval.decidedAtMs)||!epoch(now)||now<approval.decidedAtMs||
     now-approval.decidedAtMs>15*60*1000||
     !exactKeys(evidence,['tenantId','jobId','artifactSha256','quarantineSha256',
       'proposalSha256','signatureVerified','aeadVerified','mappingVerified','replayClaimAvailable'])||
     evidence.tenantId!==job.tenantId||evidence.jobId!==job.id||
     !eq(job.sha256,evidence.artifactSha256)||
     !eq(job.sha256,evidence.quarantineSha256)||
     !eq(job.mappingSha256,evidence.proposalSha256)||
     !isTrue(evidence.signatureVerified)||!isTrue(evidence.aeadVerified)||
     !isTrue(evidence.mappingVerified)||!isTrue(evidence.replayClaimAvailable))deny();
  return Object.freeze({
    tenantId:job.tenantId,jobId:job.id,
    expectedRevision:job.revision,
    sourceSha256:job.sha256,mappingSha256:job.mappingSha256,
    nextState:'importing',requiresAtomicReceipt:true,
    allowsOnlyDraft:true,approvalActorId:job.approvedBy,
  });
}
