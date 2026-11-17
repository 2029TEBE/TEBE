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
