import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, getLayoutSession } from '@/lib/api';
import { getLang } from '@/lib/i18n';
import { effectiveSubscriptionStatus, formatBillingDate } from '@/lib/subscription-display.mjs';

/**
 * Read-only customer verification view. Never infer payment or license activation
 * from checkout query parameters, client storage, or a browser redirect.
 */
export default async function VerificationPage() {
  const ar = (await getLang()) === 'ar';
  const tx = (en: string, arabic: string) => ar ? arabic : en;
  const session = await getLayoutSession();
  if (!session.authenticated) {
    if ('unavailable' in session && session.unavailable) {
      return <main className="panel" dir={ar ? 'rtl' : 'ltr'} role="alert">
        <h1>{tx('Session verification unavailable', 'تعذر التحقق من الجلسة')}</h1>
        <p>{tx('Your session has not been cleared. Retry when the service is available.', 'لم يتم حذف جلستك. أعد المحاولة عند توفر الخدمة.')}</p>
        <a href="/billing/verification">{tx('Retry', 'إعادة المحاولة')}</a>
      </main>;
    }
    redirect('/login');
  }
  if (!session.capabilities.includes('pmoa_admin')) redirect('/');
  let subscription: Awaited<ReturnType<typeof api.subscriptionCurrent>>;
  try {
    subscription = await api.subscriptionCurrent();
  } catch {
    return <main className="panel" dir={ar ? 'rtl' : 'ltr'} role="alert">
      <h1>{tx('Subscription verification unavailable', 'تعذر التحقق من الاشتراك')}</h1>
      <p>{tx('No payment or entitlement is confirmed. Please retry.', 'لم يتم تأكيد أي دفعة أو صلاحية. يرجى إعادة المحاولة.')}</p>
      <a href="/billing/verification">{tx('Retry verification', 'إعادة التحقق')}</a>
    </main>;
  }
  const status = effectiveSubscriptionStatus(subscription);
  const labels: Record<string, [string, string]> = {
    active: ['Active subscription reported by server', 'اشتراك نشط وفقًا للخادم'],
    trialing: ['Trial reported by server', 'فترة تجريبية وفقًا للخادم'],
    past_due: ['Payment overdue', 'الدفع متأخر'],
    paused: ['Subscription paused', 'الاشتراك متوقف مؤقتًا'],
    canceled: ['Subscription canceled', 'الاشتراك ملغى'],
    expired: ['Subscription expired', 'انتهى الاشتراك'],
    none: ['No subscription', 'لا يوجد اشتراك'],
    upcoming: ['Subscription not started', 'لم يبدأ الاشتراك'],
    unknown: ['Subscription status unavailable', 'حالة الاشتراك غير متاحة'],
  };
  const label = labels[status] ?? labels.unknown;
  return <main className="panel" dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'en'}>
    <h1>{tx('Subscription verification', 'التحقق من الاشتراك')}</h1>
    <p className="dim">{tx('This status comes from your authenticated workspace subscription API, not a checkout return URL.', 'تأتي هذه الحالة من واجهة اشتراك مساحة العمل المصادق عليها، وليس من رابط العودة من الدفع.')}</p>
    <p role="status"><strong>{ar ? label[1] : label[0]}</strong></p>
    {subscription && <>
      <p>{tx('Plan', 'الخطة')}: {subscription.planName ?? subscription.planCode ?? tx('Not assigned', 'غير محددة')}</p>
      <p>{tx('Current period ends', 'نهاية الفترة الحالية')}: {formatBillingDate(subscription.periodEndsAt, ar ? 'ar' : 'en')}</p>
      {subscription.cancelAtPeriodEnd && <p role="status">{tx('Cancellation is scheduled at period end.', 'تمت جدولة الإلغاء بنهاية الفترة.')}</p>}
    </>}
    <p className="dim">{tx('Payment and module access are determined by server-side verification and capability checks. A checkout redirect never grants access.', 'يحدد الخادم صلاحية الدفع والوحدات من خلال التحقق والصلاحيات. لا تمنح العودة من بوابة الدفع أي وصول.')}</p>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <Link href="/billing">{tx('Manage subscription', 'إدارة الاشتراك')}</Link>
      <a href="/billing/verification">{tx('Refresh status', 'تحديث الحالة')}</a>
    </div>
  </main>;
}
