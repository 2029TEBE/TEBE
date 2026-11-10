import { billingArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { getFrontendLocale } from '@/lib/i18n';
import { billingChangeGuidance } from '@/lib/billing-self-service.mjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Page, Loaded } from '@/components/Page';
import { api, getSession } from '@/lib/api';
import { getLang } from '@/lib/i18n';
import {
  effectiveSubscriptionStatus, availableBillingActions, daysUntil,
  formatBillingDate, formatBillingMoney,
} from '@/lib/subscription-display.mjs';

/** Read-only plan comparison and workspace billing controls. Payment confirmation is webhook-only. */
export default async function BillingPage({ searchParams }: {
  searchParams: Promise<{ error?: string; success?: string; billing?: string; updated?: string }>;
}) {
  const session = await getSession();
  if (!session.authenticated) redirect('/login');
  if (!session.capabilities.includes('pmoa_admin')) redirect('/');
  const ar = (await getLang()) === 'ar';
  const lang = ar ? 'ar' : 'en';
  const locale = await getFrontendLocale();
  const tx = (english: string) => uiLabel(english, locale, billingArabic(english));
  const { error, success, billing, updated } = await searchParams;
  const labels: Record<string, string> = {
    active: tx("Active"), trialing: tx("Trial"),
    past_due: tx("Past due"), paused: tx("Paused"),
    canceled: tx("Canceled"), expired: tx("Expired"),
    none: tx("No subscription"),
    upcoming: tx("Not started"), unknown: tx("Status unavailable"),
  };
  return <Page title={tx("Subscription and billing")}
    sub={tx("Review your plan, trial, renewal invoices, and billing options.")}>
    {error && <p role="alert" className="err">{tx("The billing request could not be completed. Please check your subscription status or contact your administrator.")}</p>}
    {success && <p role="status" className="okmsg">{tx("Renewal invoice created or found.")}</p>}
    {updated && <p role="status" className="okmsg">{tx("Subscription preference updated.")}</p>}
    {billing === 'success' && <p role="status" className="dim">{tx("You returned from Stripe Checkout. Your license renews only after our server verifies Stripe’s payment webhook.")}</p>}
    {billing === 'cancel' && <p role="status" className="dim">{tx("Stripe Checkout was canceled. No payment confirmation has been received.")}</p>}

    <Loaded load={api.subscriptionCurrent}>{subscription => {
      const status = effectiveSubscriptionStatus(subscription);
      const actions = availableBillingActions(subscription);
      const remaining = status === 'trialing' ? daysUntil(subscription?.trialEndsAt) : null;
      return <section className="panel" aria-label={tx("Current subscription")} style={{ marginBlockEnd: 20 }}>
        <h2>{tx("Your current subscription")}</h2>
        <div className="modgrid">
          <div className="modcard">
            <strong>{subscription?.planName ?? subscription?.planCode ?? tx("No plan assigned")}</strong>
            <p><span className="pill">{labels[status] ?? labels.unknown}</span></p>
            {subscription?.priceMinor != null && subscription.currency &&
              <p>{formatBillingMoney(subscription.priceMinor, subscription.currency, lang)} / {subscription.billingInterval === 'yearly' ? tx("year") : tx("month")}</p>}
            {subscription && <p className="dim">{tx("Current period")}: {formatBillingDate(subscription.periodStartsAt, lang)} — {formatBillingDate(subscription.periodEndsAt, lang)}</p>}
            {remaining !== null && <p role="status">{tx("Trial time remaining")}: <strong>{remaining}</strong> {tx("days (rounded up)")}</p>}
            {subscription?.cancelAtPeriodEnd && <p role="status">{tx("Cancellation is scheduled for the end of the current period. You keep access until then if the license remains valid.")}</p>}
          </div>
          <div className="modcard">
            <strong>{tx("Manage renewal")}</strong>
            <p className="dim">{tx("Creating an invoice does not charge your card. Renewal is applied only after a verified payment.")}</p>
            {actions.invoice && <p className="dim">{billingChangeGuidance('issue-invoice', actions.invoice, lang)}</p>}
            {actions.invoice && <form action="/api/billing/checkout" method="post">
              <input type="hidden" name="action" value="issue-invoice"/>
              <button type="submit" className="btn">{tx("Create renewal invoice")}</button>
            </form>}
            {actions.scheduleCancellation && <p className="dim">{billingChangeGuidance('schedule-cancellation', actions.scheduleCancellation, lang)}</p>}
            {actions.scheduleCancellation && <form action="/api/billing/subscription" method="post">
              <input type="hidden" name="action" value="schedule-cancellation"/>
              <button type="submit" className="btn">{tx("Cancel at period end")}</button>
            </form>}
            {actions.resume && <form action="/api/billing/subscription" method="post">
              <input type="hidden" name="action" value="resume"/>
              <button type="submit" className="btn">{tx("Keep my subscription")}</button>
            </form>}
            {!actions.invoice && !actions.resume && !actions.scheduleCancellation && <p className="dim">{tx("Self-service renewal is not available for this status. Contact your workspace administrator or the platform owner.")}</p>}
          </div>
        </div>
      </section>;
    }}</Loaded>

    <section className="panel" style={{ marginBlockEnd: 20 }} aria-label={tx("Available plans")}>
      <h2>{tx("Compare published plans")}</h2>
      <p className="dim">{tx("Prices and trial lengths come from the current plan catalogue. Module entitlements, taxes, and final commercial terms must be confirmed with your administrator. Selecting a plan here does not change your subscription.")}</p>
      <Loaded load={api.subscriptionPlans} empty={tx("No plans are published. Contact your platform administrator.")}>
        {plans => <div className="modgrid">{plans.map(plan => <article className="modcard" key={plan.code}>
          <h3>{plan.name}</h3>
          <p><strong>{formatBillingMoney(plan.priceMinor, plan.currency, lang)}</strong> / {plan.billingInterval === 'yearly' ? tx("year") : tx("month")}</p>
          <p className="dim">{plan.trialDays > 0 ? tx(`Trial: ${plan.trialDays} days`, `تجربة: ${plan.trialDays} يوم`) : tx("No trial included")}</p>
          <p className="dim">{tx("Contact an administrator to request this plan.")}</p>
        </article>)}</div>}
      </Loaded>
    </section>

    <section className="panel" style={{ marginBlockEnd: 20 }} aria-label={tx("Renewal invoices")}>
      <h2>{tx("Renewal invoices")}</h2>
      <Loaded load={api.billingInvoices} empty={tx("No renewal invoices yet.")}>
        {invoices => <div className="modgrid">{invoices.map(i => <article className="modcard" key={i.id}>
          <strong>{i.status === 'paid' ? tx("Paid") : i.status === 'open' ? tx("Open") : tx("Voided")}</strong>
          <p>{formatBillingMoney(i.amountMinor, i.currency, lang)}</p>
          <p className="dim">{formatBillingDate(i.periodStartsAt, lang)} — {formatBillingDate(i.periodEndsAt, lang)}</p>
          {i.status === 'open' && <form method="post" action="/api/billing/checkout">
            <input type="hidden" name="action" value="checkout"/>
            <input type="hidden" name="invoiceId" value={i.id}/>
            <button type="submit" className="btn">{tx("Pay securely with Stripe")}</button>
          </form>}
        </article>)}</div>}
      </Loaded>
    </section>

    <section className="panel" aria-label={tx("Payment exceptions")} style={{ marginBlockEnd: 20 }}>
      <h2>{tx("Payment exceptions requiring support")}</h2>
      <p className="dim">{tx("Refunds, disputes, and verified payments that could not renew a subscription are reviewed by support. A refunded charge does not automatically mean a new invoice or automatic repayment.")}</p>
      <Loaded load={api.billingExceptions} empty={tx("No payment exceptions recorded.")}>
        {exceptions => <div className="modgrid">{exceptions.map(item => <article className="modcard" key={item.id}>
          <strong>{({
            full_refund: tx("Full refund"),
            partial_refund: tx("Partial refund"),
            dispute_opened: tx("Payment dispute opened"),
            dispute_closed: tx("Payment dispute closed"),
            ineligible_settlement: tx("Payment needs reconciliation"),
          } as Record<string,string>)[item.exceptionType] ?? tx("Payment exception")}</strong>
          <p>{formatBillingMoney(item.amountMinor, item.currency, lang)}</p>
          <p className="dim">{formatBillingDate(item.createdAt, lang)}</p>
          {item.subscriptionPaused && <p role="status">{tx("Access is paused pending review.")}</p>}
          <p className="dim">{tx("Contact your billing support team with the invoice reference.")}</p>
          <code dir="ltr">{item.invoiceId}</code>
        </article>)}</div>}
      </Loaded>
    </section>

    <section className="panel" aria-label={tx("Billing help")}>
      <h2>{tx("Billing help and trial guidance")}</h2>
      <h3>{tx("When does a trial end?")}</h3>
      <p>{tx("Your trial ends at the deadline shown above. Paid features may stop working after the deadline unless the subscription becomes active.")}</p>
      <h3>{tx("Does a Checkout redirect mean payment succeeded?")}</h3>
      <p>{tx("No. A renewal is recorded only when our server verifies the Stripe payment event. Refresh this page to check your invoice and subscription status.")}</p>
      <h3>{tx("Can I change plans here?")}</h3>
      <p>{tx("Not yet. Plan changes and module entitlements require administrator approval. Do not assume an advertised plan includes every module.")}</p>
      <h3>{tx("What happens if I cancel?")}</h3>
      <p>{tx("Cancellation is scheduled for the current period end; it is not an immediate refund. An authorized administrator can reverse it before the period ends.")}</p>
      <p><Link href="/getting-started">{tx("Open the workspace setup guide")}</Link></p>
    </section>
  </Page>;
}
