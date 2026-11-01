'use client';
import { useRef, useState, type FormEvent } from 'react';
import { createRecoverySubmissionGate } from '@/lib/recovery-reset-feedback.mjs';
import { recoveryRequestErrorText } from '@/lib/recovery-request-feedback.mjs';
import { recoveryAcknowledged } from '@/lib/recovery-response-ack.mjs';

export function RecoveryRequestForm({ lang }: { lang: 'en' | 'ar' }) {
  const ar = lang === 'ar';
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  // React state updates are asynchronous; reject repeated submits synchronously.
  const submissionGate = useRef(createRecoverySubmissionGate());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!submissionGate.current.begin()) return;
    setError(''); setBusy(true);
    let succeeded = false;
    try {
      const res = await fetch('/api/password-recovery/request', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, lang }), cache: 'no-store' });
      if (!res.ok) {
        setError(recoveryRequestErrorText(res.status, lang));
        return;
      }
      // Only our JSON acknowledgement confirms the request was accepted.
      // Never show an email-sent message for an HTML sign-in page or 2xx error.
      let payload: unknown;
      try { payload = await res.json(); }
      catch { setError(recoveryRequestErrorText('unconfirmed', lang)); return; }
      if (!recoveryAcknowledged(res, payload)) {
        setError(recoveryRequestErrorText('unconfirmed', lang)); return;
      }
      succeeded = true;
      setComplete(true); setEmail('');
    } catch {
      // Never display browser exceptions or upstream account information.
      setError(recoveryRequestErrorText(0, lang));
    } finally {
      submissionGate.current.settle(succeeded);
      setBusy(false);
    }
  }
  if (complete) return <p role="status">{ar ? 'إذا كان الحساب نشطًا فستصلك رسالة تحتوي على رابط الاستعادة.' : 'If an active account exists, a recovery link will be emailed.'}</p>;
  return <form className="authform" onSubmit={submit} aria-busy={busy}>
    <label>{ar ? 'البريد الإلكتروني' : 'Account email'}
      <input type="email" autoComplete="email" value={email} required maxLength={254}
        onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
    {error && <p role="alert" className="formerr">{error}</p>}
    <button className="btn wide" type="submit" disabled={busy}>{busy ? '…' : (ar ? 'إرسال رابط الاستعادة' : 'Email recovery link')}</button>
  </form>;
}
