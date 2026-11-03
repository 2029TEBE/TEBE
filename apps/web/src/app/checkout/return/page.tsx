import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, getSession } from '@/lib/api';
import { getLang } from '@/lib/i18n';

export const metadata = { title: 'Checkout status | The EPMO', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Stripe's return URL is navigation only. Never grant entitlements from
 * query parameters (including success=true, session_id, or payment_intent).
 * Only the authenticated subscription API can establish billing state.
 */
export default async function CheckoutReturnPage() {
  const session = await getSession();
  if (!session.authenticated) redirect('/login');
  const ar = (await getLang()) === 'ar';
  let subscription: Awaited<ReturnType<typeof api.subscriptionCurrent>> | undefined;
  let unavailable = false;
  try {
    subscription = await api.subscriptionCurrent();
  } catch {
    unavailable = true;
  }

  // A subscription record is not proof that checkout just succeeded.
  // Activation and capability checks remain the responsibility of the API.
  const state = subscription && typeof subscription === 'object' && 'status' in subscription
    ? String(subscription.status).toLowerCase() : null;
  const active = state === 'active' || state === 'trialing';
  const title = unavailable
    ? (ar ? 'تعذر التحقق من الاشتراك' : 'Unable to verify subscription')
    : active
      ? (ar ? 'حالة الاشتراك الحالية' : 'Current subscription status')
      : (ar ? 'الدفع قيد التحقق' : 'Payment verification pending');
  const detail = unavailable
    ? (ar ? 'تعذر الاتصال بخدمة الاشتراكات. لا يعني ذلك نجاح الدفع أو فشله.' : 'The subscription service could not be reached. This does not confirm payment success or failure.')
    : active
      ? (ar ? 'تُظهر خدمة الاشتراكات حالة نشطة حاليًا. تعتمد صلاحيات الوصول على التحقق من الخادم.' : 'The subscription service currently reports an active state. Access still depends on server-verified entitlements.')
      : (ar ? 'قد يستغرق تأكيد الدفع بعض الوقت. لا تمنح صفحة العودة صلاحيات الوصول.' : 'Payment confirmation may take time. Returning from checkout never grants access.');

  return (
    <main dir={ar ? 'rtl' : 'ltr'} style={{ maxWidth: 680, margin: 'clamp(2rem, 8vw, 6rem) auto', padding: '1.5rem' }}>
      <section aria-labelledby="checkout-status-title" aria-live="polite" style={{ border: '1px solid var(--border, #777)', borderRadius: 16, padding: 'clamp(1.25rem, 4vw, 2.5rem)' }}>
        <p style={{ opacity: .8 }}>{ar ? 'The EPMO · الفوترة' : 'The EPMO · Billing'}</p>
        <h1 id="checkout-status-title">{title}</h1>
        <p>{detail}</p>
        {!unavailable && state && <p>{ar ? 'الحالة المسجلة: ' : 'Recorded status: '}<strong>{state}</strong></p>}
        <nav aria-label={ar ? 'إجراءات الاشتراك' : 'Subscription actions'} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link href="/checkout/return">{ar ? 'تحديث الحالة' : 'Refresh status'}</Link>
          <Link href="/settings">{ar ? 'إدارة الحساب' : 'Manage account'}</Link>
          <Link href="/">{ar ? 'العودة إلى لوحة التحكم' : 'Go to dashboard'}</Link>
        </nav>
      </section>
    </main>
  );
}
