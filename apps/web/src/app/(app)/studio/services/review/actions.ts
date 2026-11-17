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
