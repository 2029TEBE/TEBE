'use client';
import {useActionState,useState} from 'react';
import {saveStudioTranslations,type StudioManagementState} from './actions';

type TranslationDefinition={
 id:string;state:string;contentHash:string;definition:{
  name:Record<string,string>;
  fields:{id:string;label:Record<string,string>}[];
  steps:{id:string;label:Record<string,string>}[];
 };
};
const initial:StudioManagementState={status:'idle',message:''};
export function StudioTranslationEditor({
 row,locales,uiLocale,
}:{row:TranslationDefinition;locales:readonly string[];uiLocale:string}){
 const [selected,setSelected]=useState(uiLocale==='ar'?'ar':'en-US');
 const [result,submit,pending]=useActionState(saveStudioTranslations,initial);
 const ar=uiLocale==='ar';
 const chosen=(value:Record<string,string>)=>value[selected]||'';
 return <section className="panel" aria-labelledby="translation-edit-heading">
  <h2 id="translation-edit-heading">{ar?'تحرير ترجمات المسودة':'Edit draft translations'}</h2>
  <p className="dim">{ar
   ? 'التعديل مسموح لصاحب المسودة فقط. يحفظ كل إرسال لغة واحدة ويعيد فحص اكتمال اللغات.'
   : 'Only the draft owner may save changes. Each submission edits one locale and rechecks publication readiness.'}</p>
  <label htmlFor="studio-translation-locale">{ar?'لغة الترجمة':'Translation locale'}</label>
  <select id="studio-translation-locale" value={selected} onChange={event=>setSelected(event.target.value)}>
   {locales.map(code=><option value={code} key={code}>{code}</option>)}
  </select>
  <form action={submit} key={selected} aria-label={ar?'نموذج تحرير الترجمة':'Translation edit form'}>
   <input type="hidden" name="definitionId" value={row.id}/>
   <input type="hidden" name="expectedHash" value={row.contentHash}/>
   <input type="hidden" name="locale" value={selected}/>
   <label htmlFor="trans-name">{ar?'اسم الخدمة':'Service name'}</label>
   <input id="trans-name" name="translation:name" maxLength={1000} required defaultValue={chosen(row.definition.name)}/>
   <fieldset>
    <legend>{ar?'تسميات حقول الطلب':'Request field labels'}</legend>
    {row.definition.fields.map(field=><div key={field.id}>
      <label htmlFor={'trans-f-'+field.id}><code>{field.id}</code></label>
      <input id={'trans-f-'+field.id} name={'translation:field:'+field.id}
        required maxLength={1000} defaultValue={chosen(field.label)}/>
    </div>)}
   </fieldset>
   <fieldset>
    <legend>{ar?'تسميات مراحل الموافقة والتنفيذ':'Approval and fulfillment labels'}</legend>
    {row.definition.steps.map(step=><div key={step.id}>
      <label htmlFor={'trans-s-'+step.id}><code>{step.id}</code></label>
      <input id={'trans-s-'+step.id} name={'translation:step:'+step.id}
        required maxLength={1000} defaultValue={chosen(step.label)}/>
    </div>)}
   </fieldset>
   <button type="submit" disabled={pending}>{ar?'حفظ ترجمات المسودة':'Save draft translations'}</button>
   {result.status!=='idle'&&<p role={result.status==='error'?'alert':'status'} aria-live="polite">{result.message}</p>}
  </form>
 </section>;
}
