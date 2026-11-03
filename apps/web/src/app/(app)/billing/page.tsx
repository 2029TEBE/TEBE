import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Page, Loaded } from '@/components/Page';
import { api, getSession } from '@/lib/api';
import { getLang } from '@/lib/i18n';
import { effectiveSubscriptionStatus, formatBillingMoney, formatBillingDate } from '@/lib/subscription-display.mjs';

/** Paddle-only billing status. No checkout or subscription mutation until signed settlement is live. */
export default async function BillingPage() {
  const session = await getSession();
  if (!session.authenticated) redirect('/login');
  if (!session.capabilities.includes('pmoa_admin')) redirect('/');
  const ar = (await getLang()) === 'ar';
  const tx = (en: string, arabic: string) => ar ? arabic : en;
  return <Page title={tx('Subscription and billing', 'الاشتراك والفوترة')}
    sub={tx('Your current subscription and historical invoices', 'اشتراكك الحالي والفواتير السابقة')}>
    <p role="status" className="dim">{tx(
      'Paddle is our billing provider. Online checkout and subscription changes are temporarily unavailable pending secure payment verification. No payment is confirmed by a return link.',
      'Paddle هو مزود الفوترة. الدفع الإلكتروني وتغيير الاشتراكات غير متاحين مؤقتًا حتى اكتمال التحقق الآمن من المدفوعات. روابط العودة لا تؤكد الدفع.'
    )}</p>
    <Loaded load={api.subscriptionCurrent}>{subscription =>
      <section className="panel">
        <h2>{tx('Current subscription', 'الاشتراك الحالي')}</h2>
        <p>{tx('Plan', 'الخطة')}: {subscription?.planName ?? subscription?.planCode ?? tx('Not assigned','غير محددة')}</p>
        <p>{tx('Status', 'الحالة')}: {effectiveSubscriptionStatus(subscription)}</p>
        {subscription?.priceMinor != null && subscription.currency &&
          <p>{tx('Price', 'السعر')}: {formatBillingMoney(subscription.priceMinor,subscription.currency,ar?'ar':'en')}</p>}
        {subscription?.periodEndsAt &&
          <p>{tx('Period end', 'نهاية الفترة')}: {formatBillingDate(subscription.periodEndsAt,ar?'ar':'en')}</p>}
      </section>
    }</Loaded>
    <Loaded load={api.billingInvoices} renderEmpty>{invoices =>
      <section className="panel">
        <h2>{tx('Invoice history', 'سجل الفواتير')}</h2>
        <p className="dim">{tx('Historical records remain available for accounting.', 'السجلات المالية السابقة محفوظة للمراجعة.')}</p>
        {invoices.length === 0 ? <p>{tx('No invoices found', 'لا توجد فواتير')}</p> :
          <ul>{invoices.slice(0,50).map((invoice: any) =>
            <li key={String(invoice.id)}>{String(invoice.status ?? 'unknown')} · {formatBillingMoney(Number(invoice.amountMinor||0),String(invoice.currency||'USD'),ar?'ar':'en')}</li>
          )}</ul>}
      </section>
    }</Loaded>
    <p><Link href="/billing/verification">{tx('Verify subscription status', 'التحقق من حالة الاشتراك')}</Link></p>
  </Page>;
}
