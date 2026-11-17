/** A pure, read-only SLA assessment. No decisions, notifications or escalation
 * are performed here. Callers must never interpret "overdue" as approval.
 */
export function assessStudioApprovalSla(input:{
  phaseStartedAt:string | Date;
  now:string | Date;
  timeoutHours:number | null | undefined;
  timeoutAction:'escalate'|'reject'|'return_for_revision'|null|undefined;
}): {status:'unconfigured'|'pending'|'overdue';deadlineAt:string|null;actionRequired:string|null} {
  const {timeoutHours,timeoutAction}=input;
  if(timeoutHours==null)return {status:'unconfigured',deadlineAt:null,actionRequired:null};
  if(!Number.isSafeInteger(timeoutHours)||timeoutHours<1||timeoutHours>720)
    return {status:'unconfigured',deadlineAt:null,actionRequired:null};
  const started=new Date(input.phaseStartedAt).getTime();
  const now=new Date(input.now).getTime();
  if(!Number.isFinite(started)||!Number.isFinite(now))
    return {status:'unconfigured',deadlineAt:null,actionRequired:null};
  const deadline=started+timeoutHours*60*60*1000;
  const overdue=now>=deadline;
  return {status:overdue?'overdue':'pending',deadlineAt:new Date(deadline).toISOString(),
    actionRequired:overdue?(timeoutAction??'manual_review'):null};
}
