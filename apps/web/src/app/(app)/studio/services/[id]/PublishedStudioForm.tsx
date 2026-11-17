'use client';

import { useActionState } from 'react';
import { submitStudioService, type StudioSubmitState } from './actions';

type Field={
  id:string;type:string;label:Record<string,string>;help?:Record<string,string>;
  required?:boolean;readOnly?:boolean;options?:{id:string;label:Record<string,string>}[];
};
const initial:StudioSubmitState={status:'idle',message:''};
export function PublishedStudioForm({
  id, fields,locale,
}: {id:string;fields:Field[];locale:string}) {
  const [result,submit,pending]=useActionState(submitStudioService,initial);
  const rtl=locale==='ar'||locale==='ur';
  const message=(english:string,arabic:string)=>locale==='ar'?arabic:english;
  const copy=(dict:Record<string,string>|undefined)=>{
    const translated=dict?.[locale];
    return {value:translated?.trim()||dict?.['en-US']||'—',fallback:!translated?.trim()};
  };
  return <form action={submit} dir={rtl?'rtl':'ltr'} aria-label={message('Service request form','نموذج طلب الخدمة')}>
    <input type="hidden" name="serviceVersionId" value={id}/>
    {fields.map(field=>{
      const f=copy(field.label),help=copy(field.help),name='field:'+field.id;
      const label=<label htmlFor={'studio-'+field.id}>
        {f.value}{field.required?' *':''}
        {f.fallback && <span className="dim" lang="en"> (English fallback)</span>}
      </label>;
      const detail=field.help?.['en-US']||field.help?.[locale]
        ? <p className="dim" id={'help-'+field.id} lang={help.fallback?'en':locale}>{help.value}</p> : null;
      const attrs={id:'studio-'+field.id,name,required:!!field.required,disabled:!!field.readOnly||pending,
        'aria-describedby':detail?'help-'+field.id:undefined};
      return <div className="form-field" key={field.id} style={{marginBlock:'1rem'}}>
        {label}
        {field.type==='text' && <textarea {...attrs} maxLength={5000} rows={3}/>}
        {field.type==='number' && <input {...attrs} type="number" step="any" min={field.id==='budgetImpact'?'0':undefined}/>}
        {field.type==='date' && <input {...attrs} type="date"/>}
        {field.type==='boolean' && <input {...attrs} type="checkbox" value="on"/>}
        {field.type==='select' && <select {...attrs} defaultValue="">
          <option value="" disabled>{message('Select an option','اختر خيارا')}</option>
          {(field.options??[]).map(option=>{
            const v=copy(option.label);
            return <option key={option.id} value={option.id}>{v.value}{v.fallback?' (English fallback)':''}</option>;
          })}
        </select>}
        {field.type==='file' && <p role="note" className="dim">
          {message('Verified file attachments are not available. This service cannot be submitted.',
            'المرفقات الموثقة غير متاحة. لا يمكن إرسال هذه الخدمة.')}</p>}
        {!['text','number','date','boolean','select','file'].includes(field.type)&&
          <p role="alert">{message('Unsupported form field','حقل غير مدعوم')}</p>}
        {detail}
      </div>;
    })}
    <button type="submit" disabled={pending||fields.some(f=>!['text','number','date','boolean','select'].includes(f.type))}>
      {pending?message('Submitting…','جار إرسال الطلب…'):message('Submit governed request','إرسال طلب محكوم')}</button>
    {result.status!=='idle' && <p role={result.status==='error'?'alert':'status'} aria-live="polite">
      {result.message} {result.requestId && <code>{result.requestId}</code>}
    </p>}
  </form>;
}
