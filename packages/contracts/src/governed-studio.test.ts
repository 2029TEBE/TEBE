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


describe('Studio all-locale readiness', () => {
  it('reports every untranslated locale without silently falling back', () => {
    const missing=validateStudioDefinition(draft, ['en-US','ar','fr','ur']);
    expect(missing).toContain('name:fr');
    expect(missing).toContain('name:ur');
    expect(missing).not.toContain('name:ar');
  });
});


describe('conditional field publication validation',()=>{
  const conditional:StudioDefinition={
    ...draft,
    fields:[
      {id:'budgetImpact',type:'number',label:{'en-US':'Budget impact',ar:'الأثر المالي'},required:true},
      {id:'justification',type:'text',label:{'en-US':'Justification',ar:'المبرر'},
        required:true,visibleWhen:{fieldId:'budgetImpact',equals:1}},
    ],
  };
  it('allows a preceding direct condition of the right primitive type',()=>{
    expect(validateStudioDefinition(conditional,['en-US','ar'])).toEqual([]);
  });
  it('rejects forward and self-reference conditions',()=>{
    const fields=[...conditional.fields];
    fields[0]={...fields[0],visibleWhen:{fieldId:'justification',equals:'yes'}};
    expect(validateStudioDefinition({...conditional,fields},['en-US','ar']))
      .toContain('INVALID_VISIBILITY_SOURCE:budgetImpact');
  });
  it('rejects a mismatched condition type and chained dependencies',()=>{
    const invalid={...conditional,fields:[
      conditional.fields[0],
      {...conditional.fields[1],visibleWhen:{fieldId:'budgetImpact',equals:'1'}},
    ]} as StudioDefinition;
    expect(validateStudioDefinition(invalid,['en-US','ar']))
      .toContain('INVALID_VISIBILITY_VALUE:justification');
  });
});

describe('studio reusable field templates',()=>{
 const select={id:'decision',type:'select' as const,required:true,
   label:{'en-US':'Decision',ar:'القرار'},
   options:[{id:'yes',label:{'en-US':'Yes',ar:'نعم'}},
     {id:'no',label:{'en-US':'No',ar:'لا'}}]};
 it('accepts a valid localized select field',()=>{
   expect(validateStudioDefinition({...draft,fields:[...draft.fields,select]},['en-US','ar'])).toEqual([]);
 });
 it('rejects duplicate option identifiers and missing choices',()=>{
   const duplicated={...select,options:[select.options[0],select.options[0]]};
   expect(validateStudioDefinition({...draft,fields:[...draft.fields,duplicated]},['en-US','ar']))
     .toContain('INVALID_OR_DUPLICATE_OPTION:decision:yes');
   expect(validateStudioDefinition({...draft,fields:[...draft.fields,{...select,options:[]}]},['en-US','ar']))
     .toContain('MISSING_OPTIONS:decision');
 });
 it('rejects choices on fields that cannot render them',()=>{
   const invalid={...select,type:'text' as const};
   expect(validateStudioDefinition({...draft,fields:[...draft.fields,invalid]},['en-US','ar']))
     .toContain('OPTIONS_ON_NON_SELECT:decision');
 });
});
