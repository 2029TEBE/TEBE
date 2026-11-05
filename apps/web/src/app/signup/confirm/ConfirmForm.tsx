'use client';
import { useEffect, useState } from 'react';

export function ConfirmForm({ar}:{ar:boolean}) {
  const [token,setToken]=useState('');
  const [password,setPassword]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    const fragment=new URLSearchParams(window.location.hash.slice(1));
    const candidate=fragment.get('token') || '';
    if(/^[A-Za-z0-9_-]{43}$/.test(candidate)) setToken(candidate);
    // Never let a bearer token persist in navigation history.
    window.history.replaceState(null,'',window.location.pathname);
  },[]);
  const tx=(en:string,arabic:string)=>ar?arabic:en;
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(submitting || !token || password.length<12)return;
    setSubmitting(true);setError('');
    try {
      const response=await fetch('/api/signup/confirm',{
        method:'POST',
        headers:{'content-type':'application/json'},
        cache:'no-store',
        body:JSON.stringify({token,password}),
      });
      if(!response.ok) throw new Error('verification failed');
      window.location.replace('/login?verified=1');
    } catch {
      setError(tx('Could not verify this link. It may have expired or been used. Request a new link.',
        'تعذر التحقق من الرابط، قد يكون منتهياً أو مستخدماً. اطلب رابطاً جديداً.'));
    } finally {setSubmitting(false);}
  }
  return <form className="authform" onSubmit={submit}>
    <label>{tx('Choose a password (at least 12 characters)','اختر كلمة مرور (12 حرفاً على الأقل)')}
      <input value={password} onChange={e=>setPassword(e.target.value)}
        name="password" type="password" autoComplete="new-password" minLength={12}
        maxLength={200} required />
    </label>
    {!token && <p role="alert" className="formerr">{tx('Open the verification link from your email.',
      'افتح رابط التحقق المرسل إلى بريدك الإلكتروني.')}</p>}
    {error && <p role="alert" className="formerr">{error}</p>}
    <button className="btn wide" type="submit" disabled={!token || submitting || password.length<12}>
      {submitting?tx('Verifying…','جار التحقق…'):tx('Verify and create workspace','تحقق وأنشئ مساحة العمل')}
    </button>
  </form>;
}
