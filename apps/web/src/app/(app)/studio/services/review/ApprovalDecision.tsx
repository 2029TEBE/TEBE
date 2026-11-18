'use client';
import { useActionState } from 'react';
import { decideStudioRequest,type StudioDecisionState } from './actions';
const initial:StudioDecisionState={state:'idle',message:''};
export function ApprovalDecision({id,locale}:{id:string;locale:string}){
  const [result,action,pending]=useActionState(decideStudioRequest,initial);
  const ar=locale==='ar';
  return <form action={action} aria-label={ar?'قرار طلب الخدمة':'Service request decision'}>
    <input type="hidden" name="requestId" value={id}/>
    <label htmlFor={'decision-'+id}>{ar?'قرار الموافقة':'Approval decision'}</label>
    <select id={'decision-'+id} name="decision" required disabled={pending}>
      <option value="approved">{ar?'موافقة':'Approve'}</option>
      <option value="rejected">{ar?'رفض':'Reject'}</option>
    </select>
    <button type="submit" disabled={pending}>{ar?'تسجيل القرار':'Record decision'}</button>
    {result.state!=='idle'&&<p role={result.state==='error'?'alert':'status'} aria-live="polite">{result.message}</p>}
  </form>;
}
