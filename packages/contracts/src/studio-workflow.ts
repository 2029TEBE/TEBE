import {
  approvalOutcome, assertStudioAction, assertStudioPublish, pinStudioRequest,
  StudioPolicyError,
  type StudioDefinition, type StudioPrincipal, type StudioRequestPin,
} from './governed-studio';

/** Domain-only state machine. Caller must persist with tenant-scoped transactions
 * and compare-and-swap versions; this module never authorizes a session itself.
 */
export type StudioReviewEvent = { actorId: string; action: 'submitted' | 'approved' | 'rejected' | 'published' | 'retired'; definitionHash: string };
export type StudioRequest = {
  id: string; tenantId: string; requesterId: string;
  pinned: Readonly<StudioRequestPin>;
  phase: 'manager' | 'finance' | 'fulfillment' | 'rejected' | 'completed';
  managerApprovers: readonly string[];
  financeApprovers: readonly string[];
  managerVotes: Readonly<Record<string, 'approved' | 'rejected'>>;
  financeVotes: Readonly<Record<string, 'approved' | 'rejected'>>;
  financeRequired: boolean;
  evidence: readonly { id: string; operatorId: string; artifactId: string }[];
};

export function advanceDefinition(
  actor: StudioPrincipal, definition: StudioDefinition,
  action: 'submit_review' | 'approve' | 'publish' | 'retire',
  enabledLocales: readonly string[] = [],
): StudioDefinition {
  if (action === 'publish') assertStudioPublish(actor, definition, enabledLocales);
  else assertStudioAction(actor, definition, action);
  switch (action) {
    case 'submit_review':
      return { ...definition, state: 'in_review' };
    case 'approve':
      return { ...definition, state: 'approved', reviewerId: actor.id, reviewedHash: definition.contentHash };
    case 'publish':
      if (actor.id === definition.reviewerId) throw new StudioPolicyError('SEPARATION_OF_DUTIES');
      return { ...definition, state: 'published' };
    case 'retire':
      return { ...definition, state: 'retired' };
  }
}
export function createStudioRequest(input: {
  requestId: string; requester: StudioPrincipal; definition: StudioDefinition;
  managerApprovers: readonly string[]; financeApprovers: readonly string[];
  financeRequired: boolean;
}): StudioRequest {
  const {requestId,requester,definition,managerApprovers,financeApprovers,financeRequired}=input;
  if (requester.tenantId !== definition.tenantId) throw new StudioPolicyError('TENANT_FORBIDDEN');
  if (!requester.roles.includes('requester')) throw new StudioPolicyError('ROLE_FORBIDDEN');
  if (!requestId.trim() || !managerApprovers.length || new Set(managerApprovers).size !== managerApprovers.length)
    throw new StudioPolicyError('INVALID_MANAGER_ROUTING');
  if (financeRequired && (!financeApprovers.length || new Set(financeApprovers).size !== financeApprovers.length))
    throw new StudioPolicyError('INVALID_FINANCE_ROUTING');
  if (managerApprovers.includes(requester.id) || financeApprovers.includes(requester.id))
    throw new StudioPolicyError('SELF_APPROVAL_FORBIDDEN');
  return {
    id: requestId, tenantId:definition.tenantId, requesterId:requester.id,
    pinned:pinStudioRequest(definition), phase:'manager',managerApprovers:[...managerApprovers],
    financeApprovers:financeRequired?[...financeApprovers]:[],
    managerVotes:{},financeVotes:{},financeRequired,evidence:[],
  };
}
/** Manager ANY, then Finance ALL. No vote is automatically approved. */
export function voteStudioRequest(
  request: StudioRequest, principal: StudioPrincipal,
  decision: 'approved' | 'rejected',
): StudioRequest {
  if (principal.tenantId !== request.tenantId) throw new StudioPolicyError('TENANT_FORBIDDEN');
  if (principal.id === request.requesterId) throw new StudioPolicyError('SELF_APPROVAL_FORBIDDEN');
  if (request.phase !== 'manager' && request.phase !== 'finance') throw new StudioPolicyError('NO_ACTIVE_APPROVAL');
  const manager = request.phase === 'manager';
  const approvers = manager ? request.managerApprovers : request.financeApprovers;
  const votes = manager ? request.managerVotes : request.financeVotes;
  if (!approvers.includes(principal.id)) throw new StudioPolicyError('APPROVER_FORBIDDEN');
  if (votes[principal.id]) throw new StudioPolicyError('DUPLICATE_DECISION');
  const updated = {...votes, [principal.id]:decision};
  const outcome = approvalOutcome(manager?'any':'all',
    approvers.map(id=>updated[id]??'pending'));
  const phase: StudioRequest['phase'] = outcome === 'rejected' ? 'rejected'
    : outcome === 'approved' ? (manager && request.financeRequired?'finance':'fulfillment') : request.phase;
  return {...request,phase, ...(manager?{managerVotes:updated}:{financeVotes:updated})};
}
export function completeStudioRequest(
  request: StudioRequest, principal: StudioPrincipal,
  evidence: { id:string; artifactId:string },
): StudioRequest {
  if (principal.tenantId!==request.tenantId) throw new StudioPolicyError('TENANT_FORBIDDEN');
  if (!principal.roles.includes('operator')) throw new StudioPolicyError('ROLE_FORBIDDEN');
  if (request.phase!=='fulfillment') throw new StudioPolicyError('APPROVAL_PENDING');
  if (!evidence.id.trim() || !evidence.artifactId.trim()) throw new StudioPolicyError('EVIDENCE_REQUIRED');
  return {...request, phase:'completed', evidence:[...request.evidence,{...evidence,operatorId:principal.id}]};
}
