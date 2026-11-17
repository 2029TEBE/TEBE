import {describe,it,expect} from 'vitest';
import {LOCALE_CODES,type StudioDefinition} from '@pmo/contracts';
import {studioPublicationReadiness} from './studio-readiness';

const base:StudioDefinition={
 id:'service',tenantId:'tenant',version:1,state:'draft',
 contentHash:'a'.repeat(64),creatorId:'creator',
 name:{'en-US':'Change request'},
 fields:[{id:'reason',type:'text',required:true,label:{'en-US':'Reason'}}],
 steps:[{id:'manager',kind:'approval',assignees:['m1'],mode:'any',
 timeoutAction:'escalate',label:{'en-US':'Manager approval'}}],
};
describe('governed Studio translation publication gate',()=>{
 it('requires every canonical locale and does not mistake registry membership for coverage',()=>{
  const report=studioPublicationReadiness(base);
  expect(report.publishable).toBe(false);
  expect(report.requiredLocales).toEqual(LOCALE_CODES);
  expect(report.missing).toContain('name:ar');
 });
 it('accepts an explicitly complete localized definition',()=>{
  const name=Object.fromEntries(LOCALE_CODES.map(code=>[code,'Review-approved '+code]));
  const form:StudioDefinition={...base,name,fields:[{...base.fields[0],label:name}],
   steps:[{...base.steps[0],label:name}]};
  const report=studioPublicationReadiness(form);
  expect(report.publishable).toBe(true);
  expect(report.missing).toEqual([]);
 });
 it('blocks invalid approval semantics independent of language completeness',()=>{
  const name=Object.fromEntries(LOCALE_CODES.map(code=>[code,'Reviewed '+code]));
  const form:StudioDefinition={...base,name,fields:[{...base.fields[0],label:name}],
   steps:[{...base.steps[0],mode:undefined,label:name}]};
  expect(studioPublicationReadiness(form).missing).toContain('MISSING_APPROVAL_MODE:manager');
 });
});
