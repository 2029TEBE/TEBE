'use client';
import { useEffect, useState } from 'react';
import { uiLabel } from '@/lib/ui-labels.mjs';

/** Catches a render or fetch failure inside the app shell without blanking
 *  the whole page, and offers the one action that usually helps. */
export default function ErrorBoundary({ error, reset }:
  { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const [locale, setLocale] = useState('en-US');
  useEffect(() => { setLocale(document.documentElement.lang || 'en-US'); }, []);
  const t = (label: string) => uiLabel(label, locale);
  const unreachable = /fetch failed|ECONNREFUSED|Cannot reach/i.test(error.message);
  return (
    <div className="panel" style={{ maxWidth: '62ch' }}>
      <span className="tag" style={{ background: 'var(--crit-soft)', color: 'var(--crit)' }}>
        {t('Something went wrong')}
      </span>
      <h1 style={{ fontSize: 'var(--fs-xl)', margin: '14px 0 8px' }}>
        {unreachable ? t('The server is not responding') : t('This page could not be loaded')}
      </h1>
      <p className="dim">
        {unreachable
          ? t('The API is not reachable. If you are running locally, start it with pnpm dev and check pnpm smoke.')
          : t('The error has been logged. Try again, and if it persists quote the reference below.')}
      </p>
      {error.digest && <p className="dim">{t('Reference:')} <code>{error.digest}</code></p>}
      <div style={{ display: 'flex', gap: 10, marginBlockStart: 16 }}>
        <button className="btn" onClick={reset}>{t('Try again')}</button>
        <a className="btn ghost" href="/">{t('Back to overview')}</a>
      </div>
    </div>
  );
}
