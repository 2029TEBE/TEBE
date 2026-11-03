import Link from 'next/link';
import VerifiedPaymentRefresh from '@/components/VerifiedPaymentRefresh';
import { redirect } from 'next/navigation';
import { api, getLayoutSession } from '@/lib/api';
import { getLang } from '@/lib/i18n';
import { effectiveSubscriptionStatus } from '@/lib/subscription-display.mjs';

/**
 * Payment follow-up is informational. A Stripe return, URL parameter, or
 * browser state cannot grant a license or mark an invoice paid.
 */
export default async function PaymentPendingPage() {
  const ar = (await getLang()) === 'ar';
  const tx = (en: string, arabic: string) => ar ? arabic : en;
  const session = await getLayoutSession();
  if (!session.authenticated) {
    if ('unavailable' in session && session.unavailable) {
      return <main className="panel" role="alert" dir={ar ? 'rtl' : 'ltr'}>
        <h1>{tx('Session service unavailable', 'خدمة الجلسات غير متاحة')}</h1>
        <p>{tx('We could not verify your session. No payment or access has been confirmed.', 'تعذر التحقق من جلستك. لم يتم تأكيد الدفع أو الوصول.')}</p>
        <a href="/billing/payment-pending">{tx('Try again', 'حاول مجددًا')}</a>
      </main>;
    }
    redirect('/login');
  }
  if (!session.capabilities.includes('pmoa_admin')) redirect('/');

  let status: string;
  try {
    status = effectiveSubscriptionStatus(await api.subscriptionCurrent());
  } catch {
    return <main className="panel" role="alert" dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'en'}>
      <h1>{tx('Payment verification unavailable', 'التحقق من الدفع غير متاح')}</h1>
      <p>{tx('We cannot confirm your subscription. Do not retry payment solely because this screen is unavailable.', 'لا يمكننا تأكيد الاشتراك. لا تكرر الدفع لمجرد تعذر عرض هذه الصفحة.')}</p>
      <a href="/billing/payment-pending">{tx('Check again', 'التحقق مجددًا')}</a>
    </main>;
  }

  const active = status === 'active';
  const trial = status === 'trialing';
  return <main className="panel" dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'en'}>
    <h1>{active ? tx('Subscription active', 'الاشتراك نشط') : tx('Payment and subscription status', 'حالة الدفع والاشتراك')}</h1>
    <p role="status"><strong>{active
      ? tx('The authenticated subscription service reports an active subscription.', 'تفيد خدمة الاشتراكات المصادق عليها بأن الاشتراك نشط.')
      : trial
        ? tx('Your workspace is in a trial. A paid subscription has not been confirmed here.', 'مساحة العمل في فترة تجريبية. لم يتم تأكيد اشتراك مدفوع هنا.')
        : tx('Paid access has not been confirmed by the subscription service.', 'لم تؤكد خدمة الاشتراكات الوصول المدفوع.')}</strong></p>
    <p>{tx('Reported subscription status', 'حالة الاشتراك المبلغ عنها')}: <strong>{({
      active: tx('Active', 'نشط'), trialing: tx('Trial', 'تجريبي'),
      past_due: tx('Past due', 'متأخر السداد'), paused: tx('Paused', 'متوقف'),
      canceled: tx('Canceled', 'ملغى'), expired: tx('Expired', 'منتهي'),
      none: tx('None', 'لا يوجد'), upcoming: tx('Not started', 'لم يبدأ'),
      unknown: tx('Unavailable', 'غير متاح'),
    } as Record<string, string>)[status] ?? tx('Unavailable', 'غير متاح')}</strong></p>
    <p className="dim">{tx(
      'A successful Stripe redirect is not payment proof. Only a verified server-side payment event can update your subscription and entitlements. If you just paid in TEST mode, allow processing time and refresh.',
      'العودة الناجحة من Stripe ليست إثباتًا للدفع. لا يُحدّث الاشتراك والصلاحيات إلا حدث دفع يتحقق منه الخادم. إذا دفعت في الوضع التجريبي، انتظر المعالجة ثم حدّث الحالة.'
    )}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <VerifiedPaymentRefresh ar={ar} confirmed={active} />
      <Link href="/billing/verification">{tx('View subscription details', 'عرض تفاصيل الاشتراك')}</Link>
      <Link href="/billing">{tx('Manage billing', 'إدارة الفوترة')}</Link>
    </div>
  </main>;
}
