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
