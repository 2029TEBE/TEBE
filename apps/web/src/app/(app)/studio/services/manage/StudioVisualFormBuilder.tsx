'use client';

import { useActionState, useState } from 'react';
import { saveStudioFieldLayout, type StudioManagementState } from './actions';

type Field={
 id:string;type:'text'|'number'|'date'|'boolean'|'select'|'file';
 label:Record<string,string>;required?:boolean;readOnly?:boolean;
 help?:Record<string,string>;options?:{id:string;label:Record<string,string>}[];
 visibleWhen?:{fieldId:string;equals:string|number|boolean};
};
type Draft={id:string;state:string;contentHash:string;definition:{fields:Field[]}};
const initial:StudioManagementState={status:'idle',message:''};

/** Native drag-to-reorder with equivalent keyboard controls.
 * Presentation only: the server never trusts ordering or visibility rules
 * without reloading the session-bound, current draft.
 */
export function StudioVisualFormBuilder({row,locale}:{row:Draft;locale:string}){
 const ar=locale==='ar';
 const t=(en:string,arabic:string)=>ar?arabic:en;
 const [fields,setFields]=useState<Field[]>(row.definition.fields);
 const [dragging,setDragging]=useState<string|null>(null);
 const [state,save,pending]=useActionState(saveStudioFieldLayout,initial);
 const change=(id:string,fn:(field:Field)=>Field)=>setFields(prev=>prev.map(f=>f.id===id?fn(f):f));
 const move=(from:number,to:number)=>{
  if(from<0||to<0||from>=fields.length||to>=fields.length||from===to)return;
  setFields(prev=>{const next=[...prev];const [item]=next.splice(from,1);next.splice(to,0,item);return next;});
 };
 const [template,setTemplate]=useState<'text'|'number'|'date'|'boolean'|'select'>('text');
 const add=()=>{
  const ids=new Set(fields.map(f=>f.id));
  let n=1;while(ids.has('custom_'+n))n++;
  const field:Field={id:'custom_'+n,type:template,label:{'en-US':'Custom '+template+' field '+n},required:false,
    ...(template==='select'?{options:[{id:'option_1',label:{'en-US':'Option 1'}}]}:{})};
  setFields(prev=>[...prev,field]);
 };
 const remove=(id:string)=>setFields(prev=>prev.filter(f=>f.id!==id&&f.visibleWhen?.fieldId!==id));
 const editable=fields.every(field=>field.type!=='file');
 return <section className="panel" aria-labelledby="studio-builder-title">
  <h2 id="studio-builder-title">{t('Visual form builder — draft only','منشئ النماذج المرئي — للمسودات فقط')}</h2>
  <p className="dim">{t(
    'Drag a field to reorder, or use the Up/Down controls. Existing field types and IDs are immutable. Revisions and translations require separate review.',
    'اسحب الحقل لتغيير ترتيبه، أو استخدم أزرار أعلى وأسفل. لا يمكن تغيير معرف الحقل أو نوعه الحالي. تتطلب الترجمات والمراجعات اعتمادا منفصلا.'
  )}</p>
  <form action={save} aria-label={t('Save draft field layout','حفظ ترتيب وحقول المسودة')}>
   <input name="definitionId" type="hidden" value={row.id}/>
   <input name="expectedHash" type="hidden" value={row.contentHash}/>
   <input name="fieldLayout" type="hidden" value={JSON.stringify(fields)}/>
   <ol style={{listStyle:'none',padding:0}}>
    {fields.map((field,index)=>{
      const mandatory=field.id==='reason'||field.id==='budgetImpact';
      const possibleSources=fields.slice(0,index).filter(f=>!f.visibleWhen&&
        ['text','number','date','boolean','select'].includes(f.type));
      const selected=field.visibleWhen?.fieldId??'';
      const source=possibleSources.find(f=>f.id===selected);
      return <li key={field.id}
        draggable={!pending && !mandatory}
        onDragStart={event=>{
          if(mandatory)return;
          setDragging(field.id);
          event.dataTransfer.setData('text/plain',field.id);
          event.dataTransfer.effectAllowed='move';
        }}
        onDragOver={event=>{if(dragging)event.preventDefault();}}
        onDrop={event=>{
          event.preventDefault();
          const sourceId=event.dataTransfer.getData('text/plain');
          const sourceIndex=fields.findIndex(f=>f.id===sourceId);
          if(sourceIndex>=0&&!['reason','budgetImpact'].includes(sourceId))move(sourceIndex,index);
          setDragging(null);
        }}
        onDragEnd={()=>setDragging(null)}
        style={{border:'1px solid var(--border, #65737b)',borderRadius:8,padding:12,marginBlock:12}}>
       <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <strong>{index+1}. <code>{field.id}</code></strong>
        <span className="dim">{field.type}</span>
        <button type="button" onClick={()=>move(index,index-1)} disabled={pending||index===0} aria-label={t('Move up','نقل لأعلى')+' '+field.id}>↑</button>
        <button type="button" onClick={()=>move(index,index+1)} disabled={pending||index===fields.length-1} aria-label={t('Move down','نقل لأسفل')+' '+field.id}>↓</button>
        {!mandatory&&<button type="button" disabled={pending} onClick={()=>remove(field.id)}>{t('Remove','حذف')}</button>}
       </div>
       <label htmlFor={'builder-label-'+field.id}>{t('English field label','تسمية الحقل بالإنجليزية')}</label>
       <input id={'builder-label-'+field.id} type="text" maxLength={1000} required
         disabled={pending} value={field.label['en-US']??''}
         onChange={event=>change(field.id,f=>({...f,label:{...f.label,'en-US':event.target.value}}))}/>
       <label style={{display:'block'}}>
        <input type="checkbox" checked={!!field.required} disabled={pending||mandatory}
          onChange={event=>change(field.id,f=>({...f,required:event.target.checked}))}/>
        {t('Required','إلزامي')}
       </label>
       {!mandatory&&<div>
        <label htmlFor={'builder-when-'+field.id}>{t('Show when','إظهار عند')}</label>
        <select id={'builder-when-'+field.id} value={selected} disabled={pending} onChange={event=>{
          const match=possibleSources.find(f=>f.id===event.target.value);
          change(field.id,f=>{
            if(!match){const {visibleWhen:unused,...rest}=f;return rest;}
            return {...f,visibleWhen:{fieldId:match.id,equals:match.type==='boolean'?true:match.type==='number'?1:''}};
          });
        }}>
         <option value="">{t('Always visible','ظاهر دائما')}</option>
         {possibleSources.map(source=><option key={source.id} value={source.id}>{source.id}</option>)}
        </select>
        {source&&<div>
         <label htmlFor={'builder-match-'+field.id}>{t('Equals','يساوي')}</label>
         {source.type==='boolean'?
          <select id={'builder-match-'+field.id} disabled={pending}
            value={String(field.visibleWhen?.equals??true)}
            onChange={event=>change(field.id,f=>({...f,visibleWhen:{fieldId:source.id,equals:event.target.value==='true'}}))}>
            <option value="true">{t('Yes','نعم')}</option><option value="false">{t('No','لا')}</option>
          </select>:
          <input id={'builder-match-'+field.id} disabled={pending} required
            type={source.type==='number'?'number':'text'}
            value={String(field.visibleWhen?.equals??'')}
            onChange={event=>change(field.id,f=>({...f,visibleWhen:{
              fieldId:source.id,equals:source.type==='number'?Number(event.target.value):event.target.value,
            }}))}/>}
        </div>}
       </div>}
       {field.type==='select'&&<fieldset>
        <legend>{t('Select choices','خيارات القائمة')}</legend>
        {(field.options??[]).map((option,n)=><div key={option.id}>
         <label htmlFor={'option-label-'+field.id+'-'+option.id}>{option.id}</label>
         <input id={'option-label-'+field.id+'-'+option.id} required maxLength={1000} disabled={pending}
          value={option.label['en-US']??''}
          onChange={event=>change(field.id,f=>({...f,options:(f.options??[]).map(o=>o.id===option.id?{...o,label:{...o.label,'en-US':event.target.value}}:o)}))}/>
         <button type="button" disabled={pending||(field.options??[]).length<=1}
           onClick={()=>change(field.id,f=>({...f,options:(f.options??[]).filter(o=>o.id!==option.id)}))}>
           {t('Remove choice','حذف الخيار')}
         </button>
        </div>)}
        <button type="button" disabled={pending||(field.options??[]).length>=100}
         onClick={()=>change(field.id,f=>{
           const ids=new Set((f.options??[]).map(o=>o.id));let n=1;
           while(ids.has('option_'+n))n++;
           return {...f,options:[...(f.options??[]),{id:'option_'+n,label:{'en-US':'Option '+n}}]};
         })}>{t('Add choice','إضافة خيار')}</button>
       </fieldset>}
      </li>;
    })}
   </ol>
   <label htmlFor="builder-template">{t('New field type','نوع الحقل الجديد')}</label>
   <select id="builder-template" value={template} disabled={pending}
    onChange={event=>setTemplate(event.target.value as typeof template)}>
    <option value="text">{t('Text','نص')}</option>
    <option value="number">{t('Number','رقم')}</option>
    <option value="date">{t('Date','تاريخ')}</option>
    <option value="boolean">{t('Yes / No','نعم / لا')}</option>
    <option value="select">{t('Choice list','قائمة اختيار')}</option>
   </select>
   <button type="button" onClick={add} disabled={pending||fields.length>=100}>{t('Add field','إضافة حقل')}</button>
   <button type="submit" disabled={pending||!editable}>{t('Save unpublished layout','حفظ ترتيب المسودة')}</button>
   {!editable&&<p role="alert">{t('File fields require verified attachments; saving this layout is disabled.','تتطلب حقول الملفات مرفقات موثقة؛ حفظ هذا الترتيب معطل.')}</p>}
   {state.status!=='idle'&&<p role={state.status==='error'?'alert':'status'} aria-live="polite">{state.message}</p>}
  </form>
 </section>;
}
