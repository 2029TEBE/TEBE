import {describe,it,expect} from 'vitest';
import {assessStudioApprovalSla} from './studio-sla';

const start='2026-11-17T00:00:00.000Z';
describe('Studio approval SLA is read-only',()=>{
 it('marks a pending approval without exercising any timeout action',()=>{
  const result=assessStudioApprovalSla({phaseStartedAt:start,now:'2026-11-17T12:00:00Z',timeoutHours:24,timeoutAction:'reject'});
  expect(result).toEqual({status:'pending',deadlineAt:'2026-11-18T00:00:00.000Z',actionRequired:null});
 });
 it('flags overdue approval for human review only',()=>{
  const result=assessStudioApprovalSla({phaseStartedAt:start,now:'2026-11-19T00:00:00Z',timeoutHours:24,timeoutAction:'escalate'});
  expect(result).toEqual({status:'overdue',deadlineAt:'2026-11-18T00:00:00.000Z',actionRequired:'escalate'});
 });
 it('fails closed on invalid or missing SLA hours',()=>{
  for(const timeoutHours of [undefined,0,-1,721,1.2,Number.NaN]){
   expect(assessStudioApprovalSla({phaseStartedAt:start,now:start,timeoutHours,timeoutAction:'reject'}).status)
     .toBe('unconfigured');
  }
 });
 it('uses inclusive deadline boundaries',()=>{
  expect(assessStudioApprovalSla({phaseStartedAt:start,now:'2026-11-17T01:00:00Z',timeoutHours:1,timeoutAction:'return_for_revision'}).status)
    .toBe('overdue');
 });
});
