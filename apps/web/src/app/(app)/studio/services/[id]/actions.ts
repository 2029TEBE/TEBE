'use server';

import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/api';

export type StudioSubmitState = { status:'idle'|'error'|'success'; message:string; requestId?:string };
const ROOT=process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** One form submission, authenticated on BOTH the Next.js and NestJS sides.
 * The API re-checks tenant, caller, publication, audience and field schema.
 * No arbitrary destination, workflow execution or artifact activation.
 */
export async function submitStudioService(
  _previous: StudioSubmitState, formData: FormData,
): Promise<StudioSubmitState> {
  const id=formData.get('serviceVersionId');
  if(typeof id!=='string'||!uuid.test(id)) return {status:'error',message:'Invalid service identifier'};
  const jar=await cookies();
  const session=jar.get(SESSION_COOKIE)?.value;
  if(!session) return {status:'error',message:'Your session has ended. Please sign in again.'};
  const headers={cookie:`${SESSION_COOKIE}=${session}`};
  try {
    // Fetch only the caller-authorized schema, not arbitrary request-supplied fields.
    const schema=await fetch(`${ROOT}/api/v1/studio/catalog/${id}`,{
      headers,cache:'no-store',
    });
    if(!schema.ok) return {status:'error',message:'This service is unavailable or your permissions have changed.'};
    const def=await schema.json() as {
      fields:{id:string;type:string;required?:boolean;readOnly?:boolean;visibleWhen?:{fieldId:string;equals:string|number|boolean}}[]
    };
    if(!Array.isArray(def.fields)||def.fields.length>100)
      return {status:'error',message:'Service configuration unavailable'};
    const values:Record<string,unknown>={};
    for(const field of def.fields){
      if(!/^[a-zA-Z][a-zA-Z0-9._-]{0,99}$/.test(field.id))
        return {status:'error',message:'Invalid form field'};
      if(field.visibleWhen){
        const source=def.fields.find(item=>item.id===field.visibleWhen!.fieldId);
        if(!source || source.visibleWhen || def.fields.indexOf(source)>=def.fields.indexOf(field))
          return {status:'error',message:'Invalid conditional field configuration'};
        if(values[source.id]!==field.visibleWhen.equals)continue;
      }
      if(field.readOnly)continue;
      const raw=formData.get('field:'+field.id);
      if(field.type==='file')
        return {status:'error',message:'File intake is not available until verified attachments are enabled.'};
      if(field.type==='boolean') { values[field.id]=raw==='on';continue; }
      if(raw===null||typeof raw!=='string'||raw.trim()===''){
        if(field.required) return {status:'error',message:'A required field is missing.'};
        continue;
      }
      if(field.type==='number'){
        const n=Number(raw);
        if(!Number.isFinite(n)) return {status:'error',message:'Invalid number'};
        values[field.id]=n;
      }else if(['text','date','select'].includes(field.type)){
        values[field.id]=raw;
      }else return {status:'error',message:'Unsupported field type'};
    }
    const response=await fetch(`${ROOT}/api/v1/studio/requests`,{
      method:'POST',headers:{...headers,'content-type':'application/json'},
      body:JSON.stringify({serviceVersionId:id,values}),cache:'no-store',
    });
    if(!response.ok)return {status:'error',message:'Submission was rejected. Verify your input and authorization.'};
    const receipt=await response.json() as {id?:string};
    if(!receipt.id||!uuid.test(receipt.id))return {status:'error',message:'No verified request receipt returned.'};
    return {status:'success',message:'Request accepted. Track its status in My service requests.',requestId:receipt.id};
  }catch{
    return {status:'error',message:'Request could not be submitted. Please retry.'};
  }
}
