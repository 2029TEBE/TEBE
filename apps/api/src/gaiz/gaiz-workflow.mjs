/**
 * Pure GAIZ import workflow rules. Persistence, transactions, tenant RLS, key
 * custody and auth are deliberately NOT implemented here. Never use this
 * module alone to grant access or create business records.
 */
const transitions = Object.freeze({
  quarantined: Object.freeze(['verified', 'failed', 'rejected']),
  verified: Object.freeze(['pending_approval', 'failed', 'rejected']),
  pending_approval: Object.freeze(['approved', 'rejected', 'failed']),
  approved: Object.freeze(['importing', 'failed']),
  importing: Object.freeze(['imported', 'failed']),
  imported: Object.freeze([]),
  rejected: Object.freeze([]),
  failed: Object.freeze([]),
});
const fail = () => { throw new Error('GAIZ operation denied'); };
const validText = (x) => typeof x === 'string' && x.length > 0 && x.length <= 256;
const validRevision = x => Number.isSafeInteger(x) && x >= 0;
const verified = x => x === true;

/**
 * Only the server can provide these values, from a verified session and a
 * trusted policy lookup. Caller-supplied claims and artifact metadata do not
 * establish permissions.
 */
export function requireGaizOperation(context, operation, targetTenant) {
  if (!context || !validText(targetTenant) ||
      !validText(context.tenantId) || context.tenantId !== targetTenant ||
      !validText(context.userId) || !verified(context.authenticated) ||
      !verified(context.entitled) || !verified(context.workspaceMember) ||
      !Array.isArray(context.capabilities)) fail();
  const rights = {
    verify: 'read',
    preview: 'read',
    submit: 'pmoa_manage_projects',
    approve: 'pmoa_approve',
    reject: 'pmoa_approve',
    import: 'pmoa_manage_projects',
    export: 'pmoa_view_financials',
  };
  const needed = rights[operation];
  if (!needed || !context.capabilities.includes(needed)) fail();
  return true;
}

/** Enforce compare-and-swap semantics; storage must perform this atomically. */
export function transitionGaizImport(job, request, actor) {
  if (!job || !request || !validText(job.tenantId) ||
      !validText(job.artifactId) || !validText(job.id) ||
      !validRevision(job.revision) ||
      job.revision !== request.expectedRevision) fail();
  if (!Object.hasOwn(transitions, job.state) ||
      !transitions[job.state].includes(request.nextState)) fail();
  if (!actor || actor.tenantId !== job.tenantId ||
      !validText(actor.userId)) fail();
  const next = request.nextState;
  if (next === 'verified' && !verified(request.signatureValid)) fail();
  if (next === 'pending_approval' && !verified(request.contentValidated)) fail();
  if (next === 'approved') {
    requireGaizOperation(actor, 'approve', job.tenantId);
    if (!validText(job.requestedBy) || job.requestedBy === actor.userId || !verified(request.signatureValid) ||
        !verified(request.aeadValid) || !verified(request.mappingValidated) ||
        !verified(request.entitled)) fail();
  }
  if (next === 'importing') {
    if (!verified(request.humanApproved) ||
        !verified(request.signatureValid) ||
        !verified(request.aeadValid) ||
        !verified(request.mappingValidated) ||
        !verified(request.replayClaimAcquired) ||
        !verified(request.entitled)) fail();
    requireGaizOperation(actor, 'import', job.tenantId);
    if (!validText(job.approvedBy) || job.approvedBy !== request.approvedBy ||
        !validText(job.requestedBy) || !validText(request.approvedBy) ||
        request.approvedBy === actor.userId || job.requestedBy === job.approvedBy)
      fail(); // separation of approval and import execution
  }
  if (next === 'rejected') requireGaizOperation(actor, 'reject', job.tenantId);
  return Object.freeze({
    ...job,
    state: next,
    revision: job.revision + 1,
  });
}

/** A server-generated replay key must include tenant and issuer namespace. */
export function gaizReplayIdentity({ tenantId, issuerKeyId, artifactId }) {
  if (![tenantId, issuerKeyId, artifactId].every(validText)) fail();
  return JSON.stringify([tenantId, issuerKeyId, artifactId]);
}

export const gaizStateTransitions = transitions;
