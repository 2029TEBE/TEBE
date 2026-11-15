'use client';
import { authFormLabel } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { useState, type FormEvent } from 'react';
export function RecoveryRequestForm({ lang, locale }: { lang: 'en' | 'ar'; locale: string }) {
  const t = (english: string) => uiLabel(english, locale, authFormLabel('recovery', english, lang));
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const res = await fetch('/api/password-recovery/request', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, lang }), cache: 'no-store' });
      if (!res.ok) throw new Error(t("Recovery is unavailable right now. Try again later."));
      setComplete(true); setEmail('');
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (complete) return <p role="status">{t("If an active account exists, a recovery link will be emailed.")}</p>;
  return <form className="authform" onSubmit={submit}>
    <label>{t("Account email")}
      <input type="email" autoComplete="email" value={email} required maxLength={254}
        onChange={e => setEmail(e.target.value)} /></label>
    {error && <p role="alert" className="formerr">{error}</p>}
    <button className="btn wide" type="submit" disabled={busy}>{busy ? '…' : (t("Email recovery link"))}</button>
  </form>;
}
