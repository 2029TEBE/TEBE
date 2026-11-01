'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { consumeSecretFragmentOnce } from '@/lib/secret-fragment.mjs';
import { recoveryResetErrorText, createRecoverySubmissionGate } from '@/lib/recovery-reset-feedback.mjs';
import { recoveryAcknowledged } from '@/lib/recovery-response-ack.mjs';
export function ResetPasswordForm({ lang }: { lang: 'en' | 'ar' }) {
  const ar = lang === 'ar';
  const [ready, setReady] = useState(false);
  const fragmentConsumed = useRef(false);
  const submissionGate = useRef(createRecoverySubmissionGate());
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const value = consumeSecretFragmentOnce(fragmentConsumed, window.location.hash,
      () => window.history.replaceState(null, '', '/reset-password'));
    if (value !== undefined) { setToken(value); setReady(true); }
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirm) { setError(ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.'); return; }
    // React's busy state is asynchronous: block double clicks synchronously.
    if (!submissionGate.current.begin()) return;
    setError(''); setBusy(true);
    let succeeded = false;
    try {
      const res = await fetch('/api/password-recovery/reset', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }), cache: 'no-store' });
      if (!res.ok) { setError(recoveryResetErrorText(res.status, lang)); return; }
      // A followed login page or an unexpected 2xx payload cannot prove that
      // the single-use token was consumed or the password changed.
      let payload: unknown;
      try { payload = await res.json(); }
      catch { setError(recoveryResetErrorText('unconfirmed', lang)); return; }
      if (!recoveryAcknowledged(res, payload)) {
        setError(recoveryResetErrorText('unconfirmed', lang)); return;
      }
      succeeded = true;
      setDone(true); setToken(''); setPassword(''); setConfirm('');
    } catch {
      setError(recoveryResetErrorText(0, lang));
    } finally {
      submissionGate.current.settle(succeeded);
      setBusy(false);
    }
  }
  if (!ready) return <p>{ar ? 'جارٍ التحقق من الرابط...' : 'Checking link…'}</p>;
  if (done) return <div role="status"><p>{ar ? 'تم تغيير كلمة المرور وإلغاء الجلسات القديمة.' : 'Password updated. All previous sessions were revoked.'}</p>
    <Link href="/login">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></div>;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return <p role="alert">{ar ? 'رابط الاستعادة مفقود أو غير صالح.' : 'Recovery link is missing or invalid.'}
    {' '}<Link href="/forgot-password">{ar ? 'اطلب رابطًا جديدًا' : 'Request a new link'}</Link></p>;
  return <form className="authform" onSubmit={submit}>
    <label>{ar ? 'كلمة المرور الجديدة (12 حرفًا على الأقل)' : 'New password (at least 12 characters)'}
      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
        minLength={12} maxLength={200} autoComplete="new-password" required disabled={busy} /></label>
    <label>{ar ? 'تأكيد كلمة المرور' : 'Confirm password'}
      <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
        minLength={12} maxLength={200} autoComplete="new-password" required disabled={busy} /></label>
    {error && <p role="alert" className="formerr">{error}</p>}
    <button type="submit" className="btn wide" disabled={busy}>{busy ? '…' : (ar ? 'تغيير كلمة المرور' : 'Reset password')}</button>
  </form>;
}
