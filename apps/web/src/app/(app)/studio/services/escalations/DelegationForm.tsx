'use client';
import {useActionState} from 'react';
import {delegateStudioApproval,type StudioDecisionState} from '../review/actions';
const initial:StudioDecisionState={state:'idle',message:''};
export function DelegationForm({id,step,approverIds,locale}:{
 id:string;step:'manager'|'finance';approverIds:string[];locale:string;
}){
 const [result,submit,pending]=useActionState(delegateStudioApproval,initial);
 const ar=locale==='ar';
 return <form action={submit} aria-label={ar?'تفويض الموافقة':'Delegate approval seat'}>
  <input type="hidden" name="requestId" value={id}/>
  <input type="hidden" name="step" value={step}/>
  <label htmlFor={'delegate-original-'+id}>{ar?'صاحب الموافقة الأصلي':'Original approver'}</label>
  <select id={'delegate-original-'+id} name="originalApproverId" disabled={pending} required>
   <option value="">{ar?'اختر المعتمد':'Select approver'}</option>
   {approverIds.map(x=><option key={x} value={x}>{x}</option>)}
  </select>
  <label htmlFor={'delegate-target-'+id}>{ar?'معرف المفوض إليه':'Delegate user UUID'}</label>
  <input id={'delegate-target-'+id} name="delegateId" required disabled={pending}
   type="text" pattern="[0-9a-fA-F-]{36}" maxLength={36}
   placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/>
  <label htmlFor={'delegate-reason-'+id}>{ar?'سبب التفويض':'Delegation justification'}</label>
  <textarea id={'delegate-reason-'+id} name="reason" minLength={10} maxLength={1000}
   rows={2} required disabled={pending}/>
  <p className="dim">{ar?
   'تفويض نهائي لمقعد اعتماد واحد، ولا يعني الموافقة. يجب أن يكون المستخدم عضوا نشطا مخولا في نفس المستأجر.':
   'Permanent reassignment of one approval seat, not an approval. Delegate must be an active authorized member of this tenant.'}</p>
  <button type="submit" disabled={pending||!approverIds.length}>{ar?'تفويض المعتمد':'Delegate approval seat'}</button>
  {result.state!=='idle'&&<p role={result.state==='error'?'alert':'status'} aria-live="polite">{result.message}</p>}
 </form>;
}
