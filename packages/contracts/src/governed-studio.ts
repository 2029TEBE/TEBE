/**
 * Governed Studio domain policy. Pure, server-safe guards to be composed by the
 * authenticated TEBE API; these functions do not grant permissions themselves.
 * All locale tags must come from the tenant's ENABLED locale list, not the
 * broader locale registry (which includes partially translated locales).
 */
export type StudioRole = 'creator' | 'reviewer' | 'publisher' | 'operator' | 'requester';
export type DefinitionState = 'draft' | 'in_review' | 'approved' | 'published' | 'retired';
export type LocalizedText = Record<string, string>;
export type FormField = {
  id: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'file';
  label: LocalizedText;
  help?: LocalizedText;
  required?: boolean;
  readOnly?: boolean;
  options?: Array<{ id: string; label: LocalizedText }>;
  /** One-level deterministic condition; source must be a preceding field. */
  visibleWhen?: { fieldId: string; equals: string | number | boolean };
};
export type WorkflowStep = {
  id: string;
  kind: 'approval' | 'fulfillment';
  label: LocalizedText;
  assignees: string[];
  mode?: 'any' | 'all';
  timeoutAction?: 'escalate' | 'reject' | 'return_for_revision';
  /** Explicit SLA in hours; merely reporting overdue does NOT execute timeoutAction. */
  timeoutHours?: number;
};
export type StudioDefinition = {
  id: string;
  tenantId: string;
  version: number;
  state: DefinitionState;
  contentHash: string;
  reviewedHash?: string;
  creatorId: string;
  reviewerId?: string;
  name: LocalizedText;
  fields: FormField[];
  steps: WorkflowStep[];
};
export type StudioPrincipal = { id: string; tenantId: string; roles: readonly StudioRole[] };
export type StudioRequestPin = {
  tenantId: string; definitionId: string; formVersion: number;
  workflowVersion: number; definitionHash: string;
};
export class StudioPolicyError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'StudioPolicyError'; }
}
const requirePolicy = (ok: boolean, code: string): void => {
  if (!ok) throw new StudioPolicyError(code);
};
export function assertStudioAction(
  principal: StudioPrincipal, definition: StudioDefinition,
  action: 'edit' | 'submit_review' | 'approve' | 'publish' | 'operate' | 'retire',
): void {
  requirePolicy(principal.tenantId === definition.tenantId, 'TENANT_FORBIDDEN');
  const roles: Record<typeof action, StudioRole> = {
    edit: 'creator', submit_review: 'creator', approve: 'reviewer',
    publish: 'publisher', operate: 'operator', retire: 'publisher',
  };
  requirePolicy(principal.roles.includes(roles[action]), 'ROLE_FORBIDDEN');
  if (action === 'edit' || action === 'submit_review') {
    requirePolicy(definition.state === 'draft', 'STATE_CONFLICT');
    requirePolicy(principal.id === definition.creatorId, 'CREATOR_FORBIDDEN');
  }
  if (action === 'approve') {
    requirePolicy(definition.state === 'in_review', 'REVIEW_REQUIRED');
    requirePolicy(principal.id !== definition.creatorId, 'SELF_REVIEW_FORBIDDEN');
  }
  if (action === 'publish') {
    requirePolicy(definition.state === 'approved', 'REVIEW_REQUIRED');
    requirePolicy(!!definition.reviewedHash && definition.reviewedHash === definition.contentHash, 'VERSION_CONFLICT');
    requirePolicy(principal.id !== definition.creatorId, 'SELF_PUBLISH_FORBIDDEN');
  }
  if (action === 'operate') requirePolicy(definition.state === 'published', 'NOT_PUBLISHED');
  if (action === 'retire') requirePolicy(definition.state === 'published', 'STATE_CONFLICT');
}
function checkText(value: LocalizedText | undefined, locales: readonly string[], path: string, failures: string[]) {
  for (const locale of locales) {
    const localized = value?.[locale];
    if (typeof localized !== 'string' || !localized.trim() || /^(TODO|TBD|TRANSLATE_ME)$/i.test(localized.trim()))
      failures.push(path + ':' + locale);
  }
}
export function validateStudioDefinition(definition: StudioDefinition, enabledLocales: readonly string[]): string[] {
  const failures: string[] = [];
  if (!enabledLocales.length || new Set(enabledLocales).size !== enabledLocales.length)
    failures.push('INVALID_ENABLED_LOCALES');
  if (!definition.fields.length || !definition.steps.length) failures.push('INCOMPLETE_DEFINITION');
  checkText(definition.name, enabledLocales, 'name', failures);
  const fieldIds = new Set<string>();
  for (const field of definition.fields) {
    if (!field.id || fieldIds.has(field.id)) failures.push('DUPLICATE_FIELD_ID');
    fieldIds.add(field.id);
    if (field.visibleWhen) {
      const source = definition.fields.find(f => f.id === field.visibleWhen!.fieldId);
      if (!source || !fieldIds.has(source.id) || source.id === field.id ||
          !!source.visibleWhen || source.type === 'file')
        failures.push('INVALID_VISIBILITY_SOURCE:' + field.id);
      else if (source.type === 'number' && typeof field.visibleWhen.equals !== 'number'
        || source.type === 'boolean' && typeof field.visibleWhen.equals !== 'boolean'
        || ['text','date','select'].includes(source.type) && typeof field.visibleWhen.equals !== 'string')
        failures.push('INVALID_VISIBILITY_VALUE:' + field.id);
    }
    checkText(field.label, enabledLocales, 'field:' + field.id + ':label', failures);
    if (field.help) checkText(field.help, enabledLocales, 'field:' + field.id + ':help', failures);
    if (field.type === 'select' && !field.options?.length) failures.push('MISSING_OPTIONS:' + field.id);
    if (field.type !== 'select' && field.options?.length) failures.push('OPTIONS_ON_NON_SELECT:' + field.id);
    const optionIds = new Set<string>();
    for (const option of field.options ?? []) {
      if (!/^[a-zA-Z][a-zA-Z0-9._-]{0,99}$/.test(option.id) || optionIds.has(option.id))
        failures.push('INVALID_OR_DUPLICATE_OPTION:' + field.id + ':' + option.id);
      optionIds.add(option.id);
      checkText(option.label, enabledLocales, 'option:' + field.id + ':' + option.id, failures);
    }
  }
  const stepIds = new Set<string>();
  for (const step of definition.steps) {
    if (!step.id || stepIds.has(step.id)) failures.push('DUPLICATE_STEP_ID');
    stepIds.add(step.id);
    checkText(step.label, enabledLocales, 'step:' + step.id, failures);
    if (!step.assignees.length) failures.push('MISSING_ASSIGNEE:' + step.id);
    if (step.kind === 'approval' && !step.mode) failures.push('MISSING_APPROVAL_MODE:' + step.id);
    if (step.kind === 'approval' && !step.timeoutAction) failures.push('MISSING_TIMEOUT_POLICY:' + step.id);
    if (step.timeoutHours !== undefined && (!Number.isSafeInteger(step.timeoutHours) || step.timeoutHours < 1 || step.timeoutHours > 720))
      failures.push('INVALID_TIMEOUT_HOURS:' + step.id);
    if (step.kind !== 'approval' && step.timeoutHours !== undefined) failures.push('TIMEOUT_ON_NON_APPROVAL:' + step.id);
  }
  return failures;
}
/** Publication must call both the role guard and this validator server-side. */
export function assertStudioPublish(
  principal: StudioPrincipal, definition: StudioDefinition, enabledLocales: readonly string[],
): void {
  assertStudioAction(principal, definition, 'publish');
  requirePolicy(validateStudioDefinition(definition, enabledLocales).length === 0, 'LOCALE_OR_DEFINITION_INCOMPLETE');
}
/** Preserve immutable versions on every submitted request, including after revision. */
export function pinStudioRequest(definition: StudioDefinition): Readonly<StudioRequestPin> {
  requirePolicy(definition.state === 'published', 'NOT_PUBLISHED');
  requirePolicy(Number.isSafeInteger(definition.version) && definition.version > 0, 'INVALID_VERSION');
  return Object.freeze({
    tenantId: definition.tenantId, definitionId: definition.id,
    formVersion: definition.version, workflowVersion: definition.version,
    definitionHash: definition.contentHash,
  });
}
/** Explicit any/all semantics: pending is never silently treated as approval. */
export function approvalOutcome(
  mode: 'any' | 'all', decisions: readonly ('approved' | 'rejected' | 'pending')[],
): 'approved' | 'rejected' | 'pending' {
  if (!decisions.length) return 'pending';
  if (mode === 'all') {
    if (decisions.includes('rejected')) return 'rejected';
    return decisions.every(d => d === 'approved') ? 'approved' : 'pending';
  }
  if (decisions.includes('approved')) return 'approved';
  return decisions.every(d => d === 'rejected') ? 'rejected' : 'pending';
}
