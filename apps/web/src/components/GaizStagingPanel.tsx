'use client';
import { useState } from 'react';

type Request = {
 id:string;artifactId:string;sha256:string;status:string;
 requestedAt:string;expiresAt:string;reviewedAt?:string|null;
};
export function GaizStagingPanel({ ar, artifactBase64url }: {ar:boolean;artifactBase64url:string|null}) {
 const [requests,setRequests]=useState<Request[]>([]);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [notes,setNotes]=useState<Record<string,string>>({});
 async function call(path:string,body?:unknown) {
   const response=await fetch('/api/gaiz/'+path,{
     method:body===undefined?'GET':'POST',
     headers:body===undefined?{}:{'content-type':'application/json'},
     credentials:'same-origin',cache:'no-store',
     ...(body===undefined?{}:{body:JSON.stringify(body)}),
   });
   if(!response.ok) throw Error(response.status===503?'Development staging is disabled.':
     response.status===403?'You do not have permission.':
     response.status===409?'Duplicate, expired or self-approval prohibited.':
     'Request could not be completed.');
   return response.json();
 }
 async function load() {
   setError('');setMessage('');setBusy(true);
   try{const result=await call('requests');if(!Array.isArray(result))throw Error('Unexpected response');setRequests(result);}
   catch(e){setError(e instanceof Error?e.message:'Request failed');}
   finally{setBusy(false);}
 }
 async function stage() {
   if(!artifactBase64url)return;
   setError('');setMessage('');setBusy(true);
   try {
     const result=await call('stage',{artifactBase64url});
     if(result.importAllowed!==false)throw Error('Unexpected import authorization');
     setMessage(result.newRequest?'Request staged for independent review. No data imported.':
       'This artifact was already staged. No data imported.');
     const all=await call('requests');setRequests(Array.isArray(all)?all:[]);
   }catch(e){setError(e instanceof Error?e.message:'Request failed');}
   finally{setBusy(false);}
 }
 async function review(id:string,decision:'approved'|'rejected') {
   setError('');setMessage('');setBusy(true);
   try {
     const result=await call('requests/'+id+'/review',{decision,note:notes[id]||undefined});
     if(result.importAllowed!==false||result.appliesData!==false)throw Error('Unexpected data authorization');
     setMessage('Review recorded. No data imported or decrypted.');
     const all=await call('requests');setRequests(Array.isArray(all)?all:[]);
   }catch(e){setError(e instanceof Error?e.message:'Request failed');}
   finally{setBusy(false);}
 }
 return <section className="panel" aria-label={ar?'طلب مراجعة GAIZ':'GAIZ staging'}>
  <h2>{ar?'طلب استيراد للمراجعة فقط':'Stage for independent review'}</h2>
  <p>{ar?'سجلات الطلب فقط. يجب أن يعتمد الطلب شخص آخر مخول. لا يتم تطبيق البيانات.'
    :'Metadata-only staging. A separate authorized reviewer must decide. Even approval does not import or decrypt any data.'}</p>
  <p>
    <button type="button" disabled={!artifactBase64url||busy} onClick={stage}>{ar?'إنشاء طلب مراجعة':'Stage verified artifact'}</button>{' '}
    <button type="button" disabled={busy} onClick={load}>{ar?'عرض الطلبات':'Refresh requests'}</button>
  </p>
  {error&&<p className="err" role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
  {requests.length>0&&<div role="region" aria-label="GAIZ review requests">
   {requests.map(req=><article className="panel" key={req.id}>
    <p><strong>{req.artifactId}</strong> · {req.status}</p>
    <p className="dim" style={{overflowWrap:'anywhere'}}>SHA-256: {req.sha256}</p>
    {req.status==='pending'&&<div>
      <label htmlFor={'gaiz-review-'+req.id}>{ar?'ملاحظات المراجعة':'Review note (optional)'}</label>
      <input id={'gaiz-review-'+req.id} type="text" maxLength={500} disabled={busy}
       value={notes[req.id]??''} onChange={event=>setNotes({...notes,[req.id]:event.target.value})}/>
      <p><button type="button" disabled={busy} onClick={()=>review(req.id,'approved')}>Approve metadata review</button>{' '}
      <button type="button" disabled={busy} onClick={()=>review(req.id,'rejected')}>Reject</button></p>
    </div>}
   </article>)}
  </div>}
 </section>;
}
