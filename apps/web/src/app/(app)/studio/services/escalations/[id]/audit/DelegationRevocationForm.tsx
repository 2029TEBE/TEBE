'use client';
import {useActionState} from 'react';
import {revokeStudioDelegation,type StudioDecisionState} from '../../../review/actions';

const initial:StudioDecisionState={state:'idle',message:''};
export function DelegationRevocationForm({requestId,delegationId,locale}:{
  requestId:string;delegationId:string;locale:string;
}){
 const [result,submit,pending]=useActionState(revokeStudioDelegation,initial);
 const ar=locale==='ar';
 return <form action={submit} aria-label={ar?'إلغاء التفويض':'Revoke delegation'}>
   <input type="hidden" name="requestId" value={requestId}/>
   <input type="hidden" name="delegationId" value={delegationId}/>
   <label htmlFor={'revoke-reason-'+delegationId}>{ar?'سبب الإلغاء':'Revocation reason'}</label>
   <textarea id={'revoke-reason-'+delegationId} name="reason" minLength={10} maxLength={1000}
    required rows={2} disabled={pending}/>
   <button disabled={pending} type="submit">{ar?'إلغاء التفويض':'Revoke delegation'}</button>
   {result.state!=='idle'&&<p role={result.state==='error'?'alert':'status'} aria-live="polite">{result.message}</p>}
 </form>;
}
