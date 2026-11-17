'use client';

import {useActionState} from 'react';
import {
  createStudioDraft,transitionStudioDefinition,type StudioManagementState,
} from './actions';

const initial:StudioManagementState={status:'idle',message:''};
export function DraftCreator({locale}:{locale:string}){
  const [state,action,pending]=useActionState(createStudioDraft,initial);
  const ar=locale==='ar';
  return <form action={action} aria-label={ar?'إنشاء مسودة خدمة':'Create service draft'}>
    <p className="dim">{ar
      ? 'يتم إنشاء مسودة باللغة الإنجليزية فقط. لن تنشر قبل استكمال ترجمات اللغات المطلوبة واعتمادها.'
      : 'Creates an English-language draft only. Publishing remains blocked until every required locale is fully translated and reviewed.'}</p>
    <label htmlFor="draft-key">{ar?'معرف الخدمة':'Service key'}</label>
    <input id="draft-key" name="serviceKey" required minLength={3} maxLength={80} pattern="[a-z][a-z0-9_-]{2,79}" placeholder="project_change"/>
    <label htmlFor="draft-title">{ar?'اسم الخدمة بالإنجليزية':'English service title'}</label>
    <input id="draft-title" name="name" required maxLength={200}/>
    <label htmlFor="draft-managers">{ar?'معرفات المعتمدين (أي منهم)':'Manager approver UUIDs (ANY)'}</label>
    <textarea id="draft-managers" name="managers" required rows={2} placeholder="UUID, UUID"/>
    <label htmlFor="draft-finance">{ar?'معرفات المالية (جميعهم) - اختياري':'Finance reviewer UUIDs (ALL) — optional'}</label>
    <textarea id="draft-finance" name="finance" rows={2} placeholder="UUID, UUID"/>
    <label htmlFor="draft-operators">{ar?'معرفات المنفذين':'Fulfillment operator UUIDs'}</label>
    <textarea id="draft-operators" name="operators" required rows={2} placeholder="UUID"/>
    <label htmlFor="draft-audience">{ar?'معرفات المستخدمين المخولين':'Authorized catalog user UUIDs'}</label>
    <textarea id="draft-audience" name="audience" required rows={2} placeholder="UUID, UUID"/>
    <p className="dim">{ar
      ? 'يتم التحقق من جميع الصلاحيات على الخادم. لا تضع بيانات حساسة أو حقيقية في الاختبار.'
      : 'All permissions are enforced by the server. Do not use sensitive or production data for testing.'}</p>
    <button type="submit" disabled={pending}>{ar?'إنشاء مسودة':'Create draft'}</button>
    {state.status!=='idle'&&<p role={state.status==='error'?'alert':'status'} aria-live="polite">{state.message}</p>}
  </form>;
}
export function DefinitionActions({id,state,locale}:{id:string;state:string;locale:string}){
  const [result,action,pending]=useActionState(transitionStudioDefinition,initial);
  const ar=locale==='ar';
  const options=state==='draft'?[['submit-review',ar?'إرسال للمراجعة':'Submit for review']]
    : state==='in_review'?[['approve',ar?'اعتماد المراجع':'Reviewer approval']]
    : state==='approved'?[['publish',ar?'نشر النسخة المعتمدة':'Publish approved version']]
    : state==='published'?[['retire',ar?'إيقاف الطلبات الجديدة':'Retire service']]
    :[];
  if(!options.length)return null;
  return <form action={action} aria-label={ar?'إجراء حوكمة الخدمة':'Service governance transition'}>
    <input type="hidden" name="definitionId" value={id}/>
    <label htmlFor={'definition-action-'+id}>{ar?'الإجراء':'Action'}</label>
    <select id={'definition-action-'+id} name="transition" required>
      {options.map(([value,text])=><option key={value} value={value}>{text}</option>)}
    </select>
    <button type="submit" disabled={pending}>{ar?'إرسال للبت وفق الصلاحية':'Request authorized transition'}</button>
    {result.status!=='idle'&&<p role={result.status==='error'?'alert':'status'} aria-live="polite">{result.message}</p>}
  </form>;
}
