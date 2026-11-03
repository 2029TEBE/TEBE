'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

/** Refreshes server-rendered, authenticated subscription evidence; never sets entitlements locally. */
export default function VerifiedPaymentRefresh({ ar, confirmed }: { ar: boolean; confirmed: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checks, setChecks] = useState(0);
  const maxChecks = 8;

  useEffect(() => {
    if (confirmed || checks >= maxChecks) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setChecks(previous => Math.min(maxChecks, previous + 1));
      startTransition(() => router.refresh());
    }, 15000);
    return () => window.clearInterval(timer);
  }, [confirmed, checks, router]);

  return <section aria-label={ar ? 'التحقق من الدفع' : 'Payment verification'} aria-busy={pending}>
    <button type="button" className="btn" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? (ar ? 'جارٍ التحقق…' : 'Checking…') : (ar ? 'تحديث الحالة من الخادم' : 'Refresh server status')}
    </button>
    {!confirmed && <p className="dim" role="status">{checks >= maxChecks
      ? (ar ? 'توقف التحديث التلقائي. يمكنك التحقق يدويًا؛ لم يتم تأكيد الدفع.' : 'Automatic checks stopped. You can refresh manually; payment is not confirmed.')
      : (ar ? 'يتم التحقق تلقائيًا أثناء عرض الصفحة. لا يُفعّل هذا الإجراء الاشتراك.' : 'Checking periodically while this page is visible. This action cannot activate a subscription.')}</p>}
  </section>;
}
