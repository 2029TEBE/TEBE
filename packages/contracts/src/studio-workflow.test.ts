import {describe,it,expect} from 'vitest';
import {advanceDefinition,createStudioRequest,voteStudioRequest,completeStudioRequest} from './studio-workflow';
import type {StudioDefinition,StudioPrincipal} from './governed-studio';
const d:StudioDefinition={id:'change',tenantId:'tenant1',version:3,state:'draft',contentHash:'abc',
 creatorId:'creator',name:{'en-US':'Change'},fields:[{id:'reason',type:'text',label:{'en-US':'Reason'}}],
 steps:[{id:'manager',kind:'approval',label:{'en-US':'Manager'},mode:'any',assignees:['m1','m2'],timeoutAction:'escalate'}]};
const p=(id:string,roles:StudioPrincipal['roles'],tenantId='tenant1'):StudioPrincipal=>({id,roles,tenantId});
describe('Studio synthetic project change, fail-closed approvals',()=>{
 it('requires separate creator reviewer publisher and validated locale',()=>{
  const review=advanceDefinition(p('creator',['creator']),d,'submit_review');
  const approved=advanceDefinition(p('reviewer',['reviewer']),review,'approve');
  expect(()=>advanceDefinition(p('creator',['creator']),approved,'publish',['en-US'])).toThrow('ROLE_FORBIDDEN');
  expect(()=>advanceDefinition(p('reviewer',['reviewer','publisher']),approved,'publish',['en-US'])).toThrow('SEPARATION_OF_DUTIES');
  expect(()=>advanceDefinition(p('publisher',['publisher']),approved,'publish',['en-US','ar'])).toThrow('LOCALE_OR_DEFINITION_INCOMPLETE');
  expect(advanceDefinition(p('publisher',['publisher']),approved,'publish',['en-US']).state).toBe('published');
 });
 it('routes manager ANY then finance ALL and creates evidence',()=>{
  const published={...d,state:'published' as const};
  let r=createStudioRequest({requestId:'req1',requester:p('user',['requester']),
   definition:published,managerApprovers:['m1','m2'],financeApprovers:['f1','f2'],financeRequired:true});
  expect(r.pinned.formVersion).toBe(3);
  expect(()=>voteStudioRequest(r,p('user',['requester']),'approved')).toThrow('SELF_APPROVAL_FORBIDDEN');
  expect(()=>voteStudioRequest(r,p('f1',['reviewer']),'approved')).toThrow('APPROVER_FORBIDDEN');
  r=voteStudioRequest(r,p('m1',['reviewer']),'approved');
  expect(r.phase).toBe('finance');
  r=voteStudioRequest(r,p('f1',['reviewer']),'approved');
  expect(r.phase).toBe('finance');
  expect(()=>completeStudioRequest(r,p('op',['operator']),{id:'e1',artifactId:'gaiz1'})).toThrow('APPROVAL_PENDING');
  r=voteStudioRequest(r,p('f2',['reviewer']),'approved');
  r=completeStudioRequest(r,p('op',['operator']),{id:'e1',artifactId:'gaiz1'});
  expect(r.phase).toBe('completed');
  expect(r.evidence[0].operatorId).toBe('op');
 });
 it('rejects finance denial, duplicate decisions and other tenants',()=>{
  const r=createStudioRequest({requestId:'req2',requester:p('user',['requester']),
   definition:{...d,state:'published'},managerApprovers:['m1'],financeApprovers:['f1'],financeRequired:true});
  expect(()=>voteStudioRequest(r,p('m1',['reviewer'],'tenant2'),'approved')).toThrow('TENANT_FORBIDDEN');
  const next=voteStudioRequest(r,p('m1',['reviewer']),'approved');
  expect(voteStudioRequest(next,p('f1',['reviewer']),'rejected').phase).toBe('rejected');
  expect(()=>voteStudioRequest(next,p('m1',['reviewer']),'approved')).toThrow('APPROVER_FORBIDDEN');
 });
});
