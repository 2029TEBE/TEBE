/**
 * GAIZ isolated-worker transaction coordinator (inactive candidate).
 *
 * Designed for server-owned, independently credential-authenticated workers.
 * All collaborators MUST be injected from a trusted composition root: never
 * accept the functions, workload identity, key or DB handle from an API user.
 *
 * Assignment verification and workload binding happen before the transaction;
 * claim + audited effect MUST share exactly one transaction and either both
 * commit or both roll back. The production path is deliberately disabled.
 *
 * This is not a deployed worker, a substitute for PostgreSQL RLS, or a
 * cryptographic key-storage / credential-authentication implementation.
 */
import { bindGaizWorkerIdentity } from './gaiz-workload-binding.mjs';

const deny=()=>{throw new Error('GAIZ work unit denied')};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds=new Set(['gaiz_verify_worker','gaiz_execute_worker']);

/**
 * The effect callback must validate immutable persisted evidence, job
 * revision, human decision, and tenant RLS independently. This coordinator
 * prevents separate claim/effect transactions; it does not implement those
 * database-level controls on behalf of the effect.
 */
export async function runGaizIsolatedWorkUnit({
  encodedAssignment, workload, tenantId, workItemId, purpose,
  trustedIssuerPublicKey, nowMs, transaction, claimInTransaction,
  performInTransaction,
}={}) {
  if(process.env.NODE_ENV==='production'||
     process.env.GAIZ_DEV_ONLY!=='true'||
     !uuid.test(tenantId??'')||!uuid.test(workItemId??'')||
     !kinds.has(purpose)||typeof transaction!=='function'||
     typeof claimInTransaction!=='function'||
     typeof performInTransaction!=='function')deny();

  const assignment=bindGaizWorkerIdentity(encodedAssignment,{
    workload,tenantId,workItemId,purpose,trustedIssuerPublicKey,nowMs,
  });
  if(assignment.importAllowed!==false||
     assignment.databaseClaimRequired!==true||
     assignment.workItemId!==workItemId||
     assignment.tenantId!==tenantId||
     assignment.purpose!==purpose)deny();

  // Never create a new connection or begin a second transaction in the
  // callbacks. The caller must enforce a single isolated, tenant-scoped,
  // non-BYPASSRLS database connection for BOTH operations.
  return transaction(async tx=>{
    if(!tx||typeof tx!=='object')deny();
    const principal=Object.freeze({workerId:assignment.workerId,
      purpose:assignment.purpose});
    const claim=await claimInTransaction(tx,assignment,principal);
    if(!claim||claim.claimAcquired!==true||
       claim.assignmentId!==assignment.assignmentId||
       claim.importAllowed!==false)deny();

    const scope=Object.freeze({
      assignmentId:assignment.assignmentId,
      tenantId:assignment.tenantId,
      workItemId:assignment.workItemId,
      workerId:assignment.workerId,
      purpose:assignment.purpose,
      requiresAtomicReceipt:true,
      importAllowed:false,
    });
    const effect=await performInTransaction(tx,scope);
    if(!effect||effect.completed!==true||
       effect.tenantId!==tenantId||
       effect.workItemId!==workItemId)deny();
    // All externally observed success must follow a successful COMMIT;
    // callers must ensure their transaction wrapper does not return early.
    return Object.freeze({
      assignmentId:assignment.assignmentId,
      workItemId,tenantId,purpose,
      completed:true,
    });
  });
}
