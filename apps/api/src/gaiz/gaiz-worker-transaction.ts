/**
 * GAIZ trusted-worker transaction composition seam.
 *
 * Not registered with Nest, not deployable and not a service credential.
 * The caller must obtain workload identity from trusted ingress (e.g. a
 * verified mTLS peer) and inject a pool authenticated with the matching,
 * dedicated PostgreSQL worker role. Never derive identity from HTTP or GAIZ.
 *
 * A single, caller-provided database transaction encompasses assignment
 * replay claim AND the operation. If work throws, the caller's transaction
 * wrapper MUST rollback both. No additional transaction/connection is opened.
 */
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { claimGaizWorkerAssignmentInTransaction } from './gaiz-assignment-claim';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny=()=>{throw new ForbiddenException('GAIZ trusted worker boundary denied')};
export type GaizTrustedWorkerPurpose = 'gaiz_verify_worker' | 'gaiz_execute_worker';
export type GaizVerifiedAssignment = Readonly<{
  assignmentId:string;workerId:string;tenantId:string;workItemId:string;
  purpose:GaizTrustedWorkerPurpose;expiresAtMs:number;
  authenticatedAssignment:true;databaseClaimRequired:true;importAllowed:false;
}>;
export type GaizAuthenticatedWorkload = Readonly<{
  workerId:string;purpose:GaizTrustedWorkerPurpose;
  identitySource:'verified-mtls-peer'|'verified-workload-identity';
}>;
export type GaizWorkerTx = { execute:(statement:SQL)=>Promise<unknown> };
export type GaizWorkerPool = {
  transaction:<T>(callback:(tx:GaizWorkerTx)=>Promise<T>)=>Promise<T>;
};

/**
 * Accepts a freshly verified assignment from the signed-assignment verifier.
 * The worker process must construct the workload from an authenticated peer,
 * never a request or artifact. This is a DEV-ONLY wiring candidate.
 */
export async function withGaizTrustedWorkerTransaction<T>({
  pool,workload,assignment,operation,
}: {
  pool:GaizWorkerPool;
  workload:GaizAuthenticatedWorkload;
  assignment:GaizVerifiedAssignment;
  operation:(tx:GaizWorkerTx,assignment:GaizVerifiedAssignment)=>Promise<T>;
}):Promise<T>{
  if(process.env.NODE_ENV==='production'||process.env.GAIZ_DEV_ONLY!=='true')
    throw new ServiceUnavailableException('GAIZ worker runtime not enabled');
  if(!pool||typeof pool.transaction!=='function'||!workload||!assignment||
     typeof operation!=='function'||
     workload.identitySource!=='verified-mtls-peer'&&
     workload.identitySource!=='verified-workload-identity')deny();
  if(!UUID.test(workload.workerId)||workload.workerId!==assignment.workerId||
     workload.purpose!==assignment.purpose||
     !UUID.test(assignment.tenantId)||!UUID.test(assignment.workItemId)||
     !UUID.test(assignment.assignmentId)||
     assignment.authenticatedAssignment!==true||
     assignment.databaseClaimRequired!==true||
     assignment.importAllowed!==false)deny();
  // pool MUST belong to the dedicated worker DB role, NEVER pmo_app.
  // The claim helper checks current_user and refuses role mismatch.
  return pool.transaction(async tx=>{
    // The setting is scoped to THIS transaction only. It is not sufficient
    // authentication; assignment/workload/DB credential checks are separate.
    await tx.execute(sql`SELECT set_config('app.tenant_id',${assignment.tenantId},true)`);
    await claimGaizWorkerAssignmentInTransaction(tx,assignment,{
      workerId:workload.workerId,purpose:workload.purpose,
    });
    // The operation MUST re-read immutable evidence and CAS revision under
    // row locks. The caller's transaction must commit/rollback atomically.
    return operation(tx,assignment);
  });
}
