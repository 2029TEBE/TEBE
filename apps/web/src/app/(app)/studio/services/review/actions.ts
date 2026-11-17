'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SESSION_COOKIE } from '@/lib/api';

export type StudioDecisionState={state:'idle'|'success'|'error';message:string};
const root=process.env.API_URL??process.env.NEXT_PUBLIC_API_URL??'http://localhost:4000';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function decideStudioRequest(_old:StudioDecisionState, data:FormData):Promise<StudioDecisionState>{
  const id=data.get('requestId'),decision=data.get('decision');
  if(typeof id!=='string'||!uuid.test(id)||!['approved','rejected'].includes(String(decision)))
    return {state:'error',message:'Invalid request or decision.'};
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  if(!token)return {state:'error',message:'Session expired. Sign in again.'};
  try{
    const response=await fetch(`${root}/api/v1/studio/requests/${id}/decision`,{
      method:'POST',cache:'no-store',
      headers:{cookie:`${SESSION_COOKIE}=${token}`,'content-type':'application/json'},
      body:JSON.stringify({decision}),
    });
    if(!response.ok)return {state:'error',message:'Decision not recorded. Authorization, state or reviewer assignment may have changed.'};
    revalidatePath('/studio/services');
    return {state:'success',message:'Decision recorded by the governed Studio API.'};
  }catch{
    return {state:'error',message:'Unable to verify the decision. Check the request status before retrying.'};
  }
}

export async function recordStudioEscalationReview(_old:StudioDecisionState,data:FormData):Promise<StudioDecisionState>{
  const id=data.get('requestId'),step=data.get('step'),action=data.get('reviewAction'),rawNote=data.get('note');
  if(typeof id!=='string'||!uuid.test(id)||!['manager','finance'].includes(String(step))||
     !['acknowledged','contacted_owner','referred_to_governance'].includes(String(action))||
     typeof rawNote!=='string'||rawNote.trim().length<10||rawNote.trim().length>1000)
    return {state:'error',message:'Invalid escalation review. Add an action and a note of 10–1000 characters.'};
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  if(!token)return {state:'error',message:'Session expired. Sign in again.'};
  try{
    const response=await fetch(`${root}/api/v1/studio/requests/${id}/escalation-review`,{
      method:'POST',cache:'no-store',
      headers:{cookie:`${SESSION_COOKIE}=${token}`,'content-type':'application/json'},
      body:JSON.stringify({step,action,note:rawNote.trim()}),
    });
    if(!response.ok)return {state:'error',message:'Review not recorded. The step may no longer be overdue or you may lack administrator access.'};
    revalidatePath('/studio/services/escalations');
    return {state:'success',message:'Escalation review recorded for audit. No approval or assignment changed.'};
  }catch{return {state:'error',message:'Unable to confirm the review receipt.'};}
}
