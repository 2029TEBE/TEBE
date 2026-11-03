'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

/**
 * Re-requests the server-rendered subscription view. This component never
 * reads Stripe redirect parameters, persists a license, or grants access.
 * "confirmed" means the API reports an active subscription, NOT proof that
 * a particular payment was received.
 */
export default function VerifiedPaymentRefresh({ ar, confirmed }: { ar: boolean; confirmed: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checks, setChecks] = useState(0);
  const [online, setOnline] = useState(true);
  const maxChecks = 8;

  useEffect(() => {
    const syncConnection = () => setOnline(navigator.onLine);
    syncConnection();
    window.addEventListener('online', syncConnection);
    window.addEventListener('offline', syncConnection);
    return () => {
      window.removeEventListener('online', syncConnection);
      window.removeEventListener('offline', syncConnection);
    };
  }, []);

  useEffect(() => {
    if (confirmed || checks >= maxChecks || !online) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      setChecks(previous => Math.min(maxChecks, previous + 1));
      startTransition(() => router.refresh());
    }, 15000);
    return () => window.clearInterval(timer);
  }, [confirmed, checks, online, router]);

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
      : (ar ? 'يتم التحقق من حالة الاشتراك تلقائيًا أثناء عرض الصفحة. لا يمنح هذا الإجراء أي صلاحيات.' : 'Checking subscription status periodically while this page is visible. This action grants no entitlements.')}</p>}
  </section>;
}
