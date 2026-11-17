import { describe, it, expect } from 'vitest';
import { approvalOutcome, assertStudioPublish, pinStudioRequest, validateStudioDefinition, type StudioDefinition } from './governed-studio';
const draft: StudioDefinition = {
  id: 'project-change', tenantId: 'tenant-a', version: 1, state: 'approved',
  contentHash: 'h1', reviewedHash: 'h1', creatorId: 'creator', reviewerId: 'reviewer',
  name: { 'en-US': 'Project change', ar: 'طلب تغيير المشروع' },
  fields: [{ id: 'reason', type: 'text', required: true, label: { 'en-US': 'Reason', ar: 'السبب' } }],
  steps: [{ id: 'manager', kind: 'approval', assignees: ['manager'], mode: 'all',
    timeoutAction: 'escalate', label: { 'en-US': 'Manager review', ar: 'مراجعة المدير' } }],
};
describe('governed Studio publication gates', () => {
  const publisher = { id: 'publisher', tenantId: 'tenant-a', roles: ['publisher'] as const };
  it('rejects an unauthorized creator publishing', () => {
    expect(() => assertStudioPublish({ id:'creator', tenantId:'tenant-a', roles:['creator'] }, draft, ['en-US','ar'])).toThrow('ROLE_FORBIDDEN');
  });
  it('rejects another tenant and creator acting as publisher', () => {
    expect(() => assertStudioPublish({ ...publisher, tenantId:'tenant-b' }, draft, ['en-US','ar'])).toThrow('TENANT_FORBIDDEN');
    expect(() => assertStudioPublish({ ...publisher, id:'creator' }, draft, ['en-US','ar'])).toThrow('SELF_PUBLISH_FORBIDDEN');
  });
  it('requires unchanged reviewed content', () => {
    expect(() => assertStudioPublish(publisher, {...draft, contentHash:'h2'}, ['en-US','ar'])).toThrow('VERSION_CONFLICT');
  });
  it('blocks publication on missing enabled locale translations', () => {
    expect(validateStudioDefinition(draft, ['en-US','ar','fr'])).toContain('name:fr');
    expect(() => assertStudioPublish(publisher, draft, ['en-US','ar','fr'])).toThrow('LOCALE_OR_DEFINITION_INCOMPLETE');
  });
  it('permits valid translated version only to separate publisher', () => {
    expect(() => assertStudioPublish(publisher, draft, ['en-US','ar'])).not.toThrow();
  });
  it('uses explicit ANY/ALL semantics', () => {
    expect(approvalOutcome('all',['approved','pending'])).toBe('pending');
    expect(approvalOutcome('all',['approved','rejected'])).toBe('rejected');
    expect(approvalOutcome('any',['rejected','approved'])).toBe('approved');
    expect(approvalOutcome('any',['rejected','pending'])).toBe('pending');
  });
  it('pins published requests to immutable form and workflow versions', () => {
    expect(() => pinStudioRequest(draft)).toThrow('NOT_PUBLISHED');
    expect(pinStudioRequest({...draft,state:'published'})).toMatchObject({formVersion:1,workflowVersion:1,definitionHash:'h1'});
  });
});
