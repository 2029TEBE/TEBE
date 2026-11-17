'use server';

import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getSession, SESSION_COOKIE } from '@/lib/api';

const ROOT=process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type StudioManagementState={status:'idle'|'success'|'error';message:string};
async function auth():Promise<{cookie:string;tenantId:string;userId:string}|null>{
  const session=await getSession();
  if(!session.authenticated || !uuid.test(session.userId) || !uuid.test(session.tenantId))return null;
  const raw=(await cookies()).get(SESSION_COOKIE)?.value;
  if(!raw) return null;
  return {cookie:`${SESSION_COOKIE}=${raw}`,tenantId:session.tenantId,userId:session.userId};
}
const invalid=(message:string):StudioManagementState=>({status:'error',message});
const read=(data:FormData,key:string)=>String(data.get(key)??'').trim();
const ids=(text:string)=>text.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean);
export async function createStudioDraft(_prev:StudioManagementState,data:FormData):Promise<StudioManagementState>{
  const me=await auth();
  if(!me)return invalid('Sign in to an authorized workspace first.');
  const serviceKey=read(data,'serviceKey'),name=read(data,'name');
  if(!/^[a-z][a-z0-9_-]{2,79}$/.test(serviceKey)||!name||name.length>200)
    return invalid('Enter a valid service key and title.');
  const manager=ids(read(data,'managers')),operator=ids(read(data,'operators')),
    audience=ids(read(data,'audience')),finance=ids(read(data,'finance'));
  if(!manager.length||!operator.length||!audience.length||
     [manager,operator,audience,finance].some(values=>values.length>50||values.some(id=>!uuid.test(id)||new Set(values).size!==values.length)))
    return invalid('Provide unique UUIDs for manager approvers, operators and authorized users.');
  if(manager.includes(me.userId)||finance.includes(me.userId))
    return invalid('The requester/creator cannot be included as an approver in this template.');
  // Only reviewed English is entered. Every additional locale must be
  // translated and reviewed before the backend allows publication.
  const steps=[
    {id:'manager',kind:'approval',label:{'en-US':'Manager approval'},
     assignees:manager,mode:'any',timeoutAction:'escalate'},
    ...(finance.length?[{id:'finance',kind:'approval',label:{'en-US':'Finance approval'},
      assignees:finance,mode:'all',timeoutAction:'escalate'}]:[]),
    {id:'fulfillment',kind:'fulfillment',label:{'en-US':'Fulfillment'},
     assignees:operator},
  ];
  const fields=[
    {id:'reason',type:'text',required:true,label:{'en-US':'Change reason'}},
    ...(finance.length?[{id:'budgetImpact',type:'number',required:true,
      label:{'en-US':'Budget impact'}}]:[]),
  ];
  const definition={
    id:serviceKey,tenantId:me.tenantId,version:1,state:'draft',creatorId:me.userId,
    name:{'en-US':name},accessUserIds:audience,fields,steps,
  };
  const contentHash=createHash('sha256').update(JSON.stringify(definition)).digest('hex');
  try{
    const result=await fetch(`${ROOT}/api/v1/studio/definitions`,{
      method:'POST',cache:'no-store',headers:{cookie:me.cookie,'content-type':'application/json'},
      body:JSON.stringify({serviceKey,definition:{...definition,contentHash}}),
    });
    if(!result.ok)return invalid('Draft creation was rejected. Check your role, service key and workspace configuration.');
    revalidatePath('/studio/services');
    return {status:'success',message:'Draft created. It is not published; complete all locale translations and independent review before publication.'};
  }catch{return invalid('Could not reach Studio. No draft was confirmed.');}
}
export async function transitionStudioDefinition(_prev:StudioManagementState,data:FormData):Promise<StudioManagementState>{
  const me=await auth();
  if(!me)return invalid('Sign in to an authorized workspace first.');
  const id=read(data,'definitionId'),action=read(data,'transition');
  if(!uuid.test(id)||!['submit-review','approve','publish','retire'].includes(action))
    return invalid('Invalid definition or action.');
  try{
    const result=await fetch(`${ROOT}/api/v1/studio/definitions/${id}/${action}`,{
      method:'POST',cache:'no-store',headers:{cookie:me.cookie},
    });
    if(!result.ok) return invalid('Transition rejected by Studio authorization, review, state or translation checks.');
    revalidatePath('/studio/services');
    return {status:'success',message:'Governance transition accepted by the server.'};
  }catch{return invalid('Could not reach Studio. No transition was confirmed.');}
}

/** Create a new unpublished version; server checks creator capability and serializes revisions. */
export async function reviseStudioDefinition(_prev:StudioManagementState,data:FormData):Promise<StudioManagementState>{
  const me=await auth();
  if(!me)return invalid('Sign in to an authorized workspace first.');
  const id=read(data,'definitionId');
  if(!uuid.test(id))return invalid('Invalid definition identifier');
  try{
    const r=await fetch(`${ROOT}/api/v1/studio/definitions/${id}/revise`,{
      method:'POST',headers:{cookie:me.cookie},cache:'no-store',
    });
    if(!r.ok)return invalid('Only published or retired definitions may be revised. A draft may already exist.');
    revalidatePath('/studio/services');
    return {status:'success',message:'New draft version created. Previously published requests remain pinned to their original version.'};
  }catch{return invalid('Revision could not be confirmed.');}
}
/** Server determines all editable field/step identities from the stored draft,
 * accepting only localized values for those IDs. Approvals and audience
 * are never editable from this translation-only action.
 */
export async function saveStudioTranslations(_prev:StudioManagementState,data:FormData):Promise<StudioManagementState>{
  const me=await auth();
  if(!me)return invalid('Sign in to an authorized workspace first.');
  const id=read(data,'definitionId'),expectedHash=read(data,'expectedHash'),locale=read(data,'locale');
  if(!uuid.test(id)||!/^[a-f0-9]{64}$/.test(expectedHash))return invalid('Invalid revision or content checksum');
  const supported=['ar','en-US','en-GB','bn','de','es','es-419','fil','fr','hi','id','it','ja','ko','pt-BR','pt-PT','ru','sw','tr','ur','vi','zh-CN','zh-TW'];
  if(!supported.includes(locale))return invalid('Unsupported translation locale');
  try{
    const result=await fetch(`${ROOT}/api/v1/studio/definitions/${id}`,{
      headers:{cookie:me.cookie},cache:'no-store',
    });
    if(!result.ok)return invalid('Definition unavailable or access denied');
    const row=await result.json() as {
      state:string;contentHash:string;creatorId:string;
      definition:{
        name:Record<string,string>;accessUserIds:string[];
        fields:{id:string;label:Record<string,string>;help?:Record<string,string>}[];
        steps:{id:string;label:Record<string,string>}[];
      };
    };
    if(row.state!=='draft'||row.creatorId!==me.userId)return invalid('Only the owning creator can edit a draft');
    if(row.contentHash!==expectedHash)return invalid('This draft changed. Reload to avoid overwriting newer translations');
    const clean=(value:string)=>value.trim().slice(0,1000);
    const name=clean(read(data,'translation:name'));
    if(!name)return invalid('Service name translation cannot be empty');
    const nextName={...row.definition.name,[locale]:name};
    const fields=row.definition.fields.map(field=>{
      const raw=data.get('translation:field:'+field.id);
      if(typeof raw!=='string')throw Error('Missing field translation');
      const label=clean(raw);
      if(!label)throw Error('Field translation required');
      return {...field,label:{...field.label,[locale]:label}};
    });
    const steps=row.definition.steps.map(step=>{
      const raw=data.get('translation:step:'+step.id);
      if(typeof raw!=='string')throw Error('Missing workflow translation');
      const label=clean(raw);
      if(!label)throw Error('Workflow translation required');
      return {...step,label:{...step.label,[locale]:label}};
    });
    const updated=await fetch(`${ROOT}/api/v1/studio/definitions/${id}/draft`,{
      method:'PATCH',cache:'no-store',headers:{cookie:me.cookie,'content-type':'application/json'},
      body:JSON.stringify({expectedHash,name:nextName,accessUserIds:row.definition.accessUserIds,fields,steps}),
    });
    if(!updated.ok)return invalid('Draft update rejected by authorization or concurrency checks. Reload before retrying.');
    revalidatePath('/studio/services');
    revalidatePath('/studio/services/manage/'+id);
    return {status:'success',message:'Translations saved to the draft only. Publication still requires all locales and independent approval.'};
  }catch{return invalid('Translation update was not confirmed. Check that every field has a label.');}
}

/** Visual editor writes only a reviewed draft's field layout. The existing
 * service identity, approval assignments, audience and other translations
 * always come from the authenticated API rather than client form payloads.
 */
export async function saveStudioFieldLayout(
  _prev:StudioManagementState,data:FormData,
):Promise<StudioManagementState>{
  const me=await auth();
  if(!me)return invalid('An authenticated workspace session is required.');
  const id=read(data,'definitionId'),expectedHash=read(data,'expectedHash');
  const raw=data.get('fieldLayout');
  if(!uuid.test(id)||!/^[a-f0-9]{64}$/.test(expectedHash)||
    typeof raw!=='string'||raw.length>48000)return invalid('Invalid draft layout payload.');
  type Field={
    id:string;type:'text'|'number'|'date'|'boolean'|'select';
    label:Record<string,string>;required?:boolean;readOnly?:boolean;
    help?:Record<string,string>;visibleWhen?:{fieldId:string;equals:string|number|boolean};
    options?:{id:string;label:Record<string,string>}[];
  };
  let changes:Field[];
  try{changes=JSON.parse(raw) as Field[];}catch{return invalid('Malformed form layout.');}
  if(!Array.isArray(changes)||changes.length<1||changes.length>100)
    return invalid('A form must have 1 to 100 fields.');
  if(changes.some(field=>!field||typeof field.id!=='string'||
    !/^[a-zA-Z][a-zA-Z0-9._-]{0,99}$/.test(field.id)||
    !['text','number','date','boolean','select'].includes(field.type)||
    !field.label||typeof field.label['en-US']!=='string'||
    !field.label['en-US'].trim()||field.label['en-US'].length>1000))
    return invalid('One or more fields are invalid.');
  if(new Set(changes.map(field=>field.id)).size!==changes.length)
    return invalid('Each field must have a distinct identifier.');
  try{
    const response=await fetch(`${ROOT}/api/v1/studio/definitions/${id}`,{
      headers:{cookie:me.cookie},cache:'no-store',
    });
    if(!response.ok)return invalid('Draft unavailable or no longer authorized.');
    const record=await response.json() as {
      state:string;creatorId:string;contentHash:string;
      definition:{
        name:Record<string,string>;accessUserIds:string[];
        fields:Field[];steps:unknown[];
      };
    };
    if(record.state!=='draft'||record.creatorId!==me.userId)
      return invalid('Only the owning creator may edit an unpublished draft.');
    if(record.contentHash!==expectedHash)
      return invalid('Draft changed. Reload before saving the field layout.');
    const current=new Map(record.definition.fields.map(field=>[field.id,field]));
    if(!changes.some(field=>field.id==='reason'&&field.type==='text'&&field.required))
      return invalid('The mandatory reason field cannot be removed.');
    if(record.definition.steps.some(step=>
       typeof step==='object' && step!==null && 'id' in step && step.id==='finance') &&
       !changes.some(field=>field.id==='budgetImpact'&&field.type==='number'&&
         field.required&&!field.visibleWhen&&!field.readOnly))
      return invalid('Finance workflow requires a mandatory unconditional budget impact.');
    const fields=changes.map(field=>{
      const old=current.get(field.id);
      if(old&&old.type!==field.type)throw Error('Changing the type of an existing field requires a new identifier.');
      if(field.id==='reason' && (field.type!=='text'||!field.required))throw Error('Invalid mandatory reason field.');
      if(field.id==='budgetImpact'&&(field.type!=='number'||!!field.visibleWhen))throw Error('Invalid budgetImpact field.');
      // Preserve reviewed copy for other languages unless a separate translation
      // editor explicitly changes it. Do not claim an English edit updates them.
      return {...(old??{}),...field,
        label:{...(old?.label??{}),'en-US':field.label['en-US']},
        ...(old?.help?{help:old.help}:{}),
      };
    });
    const update=await fetch(`${ROOT}/api/v1/studio/definitions/${id}/draft`,{
      method:'PATCH',cache:'no-store',
      headers:{cookie:me.cookie,'content-type':'application/json'},
      body:JSON.stringify({expectedHash,
        name:record.definition.name,
        accessUserIds:record.definition.accessUserIds,
        fields,steps:record.definition.steps}),
    });
    if(!update.ok)return invalid('Server rejected the layout or its concurrency/version checks. Reload before retrying.');
    revalidatePath('/studio/services');
    revalidatePath('/studio/services/manage/'+id);
    return {status:'success',message:'Draft layout saved. All required translations and independent approvals are still required.'};
  }catch{return invalid('Layout not saved. Check field types, visibility dependencies and revision state.');}
}
