'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

/**
 * Informational server revalidation only: never use browser state, Paddle redirects
 * redirects, or the result of router.refresh() to grant entitlements.
 */
export default function VerifiedPaymentRefresh({ ar, confirmed }: { ar: boolean; confirmed: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checks, setChecks] = useState(0);
  const [online, setOnline] = useState(true);
  const [visible, setVisible] = useState(true);
  const maxChecks = 8;

  useEffect(() => {
    const syncConnection = () => setOnline(navigator.onLine);
    const syncVisibility = () => setVisible(document.visibilityState === 'visible');
    syncConnection();
    syncVisibility();
    window.addEventListener('online', syncConnection);
    window.addEventListener('offline', syncConnection);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      window.removeEventListener('online', syncConnection);
      window.removeEventListener('offline', syncConnection);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  // A hidden tab or an offline device must not consume the bounded retry
  // budget. Avoid scheduling overlapping refreshes during a transition.
  useEffect(() => {
    if (confirmed || pending || checks >= maxChecks || !online || !visible) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      setChecks(previous => Math.min(maxChecks, previous + 1));
      startTransition(() => router.refresh());
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [confirmed, pending, checks, online, visible, router]);

  const refresh = () => {
    if (pending || !online) return;
    startTransition(() => router.refresh());
  };

  return <section aria-label={ar ? 'التحقق من حالة الاشتراك' : 'Subscription status verification'} aria-busy={pending}>
    <button type="button" className="btn" disabled={pending || !online} onClick={refresh}>
      {pending ? (ar ? 'جارٍ التحقق…' : 'Checking…') : (ar ? 'تحديث الحالة من الخادم' : 'Refresh server status')}
    </button>
    {!online && <p role="alert" className="dim">{ar
      ? 'لا يوجد اتصال بالإنترنت. لا يمكن التحقق من حالة الاشتراك حتى يعود الاتصال.'
      : 'You are offline. Subscription status cannot be checked until the connection returns.'}</p>}
    {!confirmed && online && <p className="dim" role="status">{checks >= maxChecks
      ? (ar ? 'توقف التحديث التلقائي. يمكنك التحقق يدويًا؛ لا يوجد إثبات لدفع جديد.' : 'Automatic checks stopped. You can refresh manually; no new payment has been proven.')
      : !visible
        ? (ar ? 'توقف التحقق التلقائي مؤقتًا حتى تعود إلى هذه الصفحة.' : 'Automatic checking is paused until you return to this tab.')
        : (ar ? 'يتم التحقق من حالة الاشتراك تلقائيًا أثناء عرض الصفحة. لا يمنح هذا الإجراء أي صلاحيات.' : 'Checking subscription status periodically while this page is visible. This action grants no entitlements.')}</p>}
  </section>;
}
