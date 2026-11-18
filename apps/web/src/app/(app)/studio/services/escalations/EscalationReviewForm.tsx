'use client';
import {useActionState} from 'react';
import {recordStudioEscalationReview,type StudioDecisionState} from '../review/actions';
const initial:StudioDecisionState={state:'idle',message:''};
export function EscalationReviewForm({id,step,locale}:{id:string;step:'manager'|'finance';locale:string}){
 const [result,submit,pending]=useActionState(recordStudioEscalationReview,initial);
 const ar=locale==='ar';
 return <form action={submit} aria-label={ar?'تسجيل مراجعة التصعيد':'Record escalation review'}>
  <input type="hidden" name="requestId" value={id}/>
  <input type="hidden" name="step" value={step}/>
  <label htmlFor={'studio-escalation-action-'+id}>{ar?'الإجراء البشري':'Human follow-up'}</label>
  <select id={'studio-escalation-action-'+id} name="reviewAction" disabled={pending} required>
   <option value="acknowledged">{ar?'تم الاطلاع':'Acknowledged'}</option>
   <option value="contacted_owner">{ar?'تم التواصل مع المسؤول':'Contacted owner'}</option>
   <option value="referred_to_governance">{ar?'أحيل للحوكمة':'Referred to governance'}</option>
  </select>
  <label htmlFor={'studio-escalation-note-'+id}>{ar?'ملاحظة التدقيق':'Audit note'}</label>
  <textarea id={'studio-escalation-note-'+id} name="note" required minLength={10} maxLength={1000}
   rows={2} disabled={pending} placeholder={ar?'اشرح الإجراء الذي تم اتخاذه':'Describe the human action already taken'}/>
  <button disabled={pending} type="submit">{ar?'تسجيل المراجعة':'Record audit receipt'}</button>
  {result.state!=='idle'&&<p role={result.state==='error'?'alert':'status'} aria-live="polite">{result.message}</p>}
 </form>;
}
