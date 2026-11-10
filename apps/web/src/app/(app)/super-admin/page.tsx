import { superadminArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { getFrontendLocale } from '@/lib/i18n';
import { redirect } from 'next/navigation';
import { api, getSession } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { getLang } from '@/lib/i18n';


/** This is a vendor-only page. Its backing APIs independently enforce the vendor flag. */
export default async function SuperAdmin({ searchParams }: {
  searchParams: Promise<{ done?: string; error?: string; offset?: string }>;
}) {
  const session = await getSession();
  if (!session.authenticated) redirect('/login');
  if (!session.capabilities.includes('pmoa_platform')) redirect('/');
  const ar = (await getLang()) === 'ar';
  const { done, error, offset } = await searchParams;
  const page = Math.max(0, Math.min(10_000, Number(offset ?? 0) || 0));
  const locale = await getFrontendLocale();
  const tx = (english: string) => uiLabel(english, locale, superadminArabic(english));
  return (
    <Page title={tx("Super Admin — Licensing")}
      sub={tx("Manage customer subscriptions and plans. Manual license grants do not verify payment.")}>
      {done && <p className="okmsg" role="status">{tx("Change saved and audited.")}</p>}
      {error && <p className="err" role="alert">{error}</p>}
      <section className="design-context" aria-label={tx("Vendor administration context")}>
        <div className="design-context-head">
          <span className="design-kicker">{tx("VENDOR CONTROLS / LIVE OPERATIONS")}</span>
          <h2>{tx("Subscription management with accountable controls")}</h2>
          <p>{tx("The forms below change real subscriptions. Access is restricted to platform administrators; use documented authorization before taking an action.")}</p>
        </div>
        <div className="design-summary">
          <div className="design-metric">
            <small>{tx("01 / Verify")}</small>
            <strong className="design-vendor-word">{tx("Authority")}</strong>
            <small>{tx("Confirm the authorized customer and plan")}</small>
          </div>
          <div className="design-metric">
            <small>{tx("02 / Record")}</small>
            <strong className="design-vendor-word">{tx("Reason")}</strong>
            <small>{tx("Record a meaningful business reference")}</small>
          </div>
          <div className="design-metric">
            <small>{tx("03 / Review")}</small>
            <strong className="design-vendor-word">{tx("Audit")}</strong>
            <small>{tx("Review the audit history after a change")}</small>
          </div>
        </div>
      </section>
      <section className="panel" style={{marginBlockEnd:24}}>
        <h2>{tx("Create subscription plan")}</h2>
        <form method="post" action="/api/super-admin" style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end'}}>
          <input name="action" type="hidden" value="create-plan"/>
          <label>{tx("Code")}<input required name="code" placeholder="enterprise_yearly" pattern="[a-z][a-z0-9_-]{2,39}"/></label>
          <label>{tx("Name")}<input required name="name" minLength={3} maxLength={120}/></label>
          <label>{tx("Price in minor units")}<input required type="number" min="0" name="priceMinor" defaultValue="0"/></label>
          <label>{tx("Currency")}<input required name="currency" maxLength={3} defaultValue="SAR"/></label>
          <label>{tx("Interval")}<select name="billingInterval"><option value="monthly">{tx("Monthly")}</option><option value="yearly">{tx("Yearly")}</option></select></label>
          <label>{tx("Trial days")}<input type="number" min="0" max="365" name="trialDays" defaultValue="0"/></label>
          <button type="submit" className="btn">{tx("Create plan")}</button>
        </form>
      </section>
      <section className="panel" style={{marginBlockEnd:24}}>
        <h2>{tx("Available plans")}</h2>
        <Loaded load={api.superAdminPlans}>{plans => <div className="modgrid">
          {plans.map((p: any) => <div className="modcard" key={p.id}>
            <strong>{p.name}</strong><p className="dim">{p.code} · {(p.priceMinor / 100).toFixed(2)} {p.currency} / {p.billingInterval}</p>
            <p>{tx("Trial")}: {p.trialDays} {tx("days")}</p>
            <form method="post" action="/api/super-admin">
              <input name="action" type="hidden" value="update-plan"/>
              <input name="code" type="hidden" value={p.code}/>
              <input name="isActive" type="hidden" value={p.isActive ? 'false':'true'}/>
              <button className="btn ghost" type="submit">{p.isActive ? tx("Deactivate"): tx("Activate")}</button>
            </form>
          </div>)}
        </div>}</Loaded>
      </section>
      <section className="panel">
        <h2>{tx("Customer licenses")}</h2>
        <p className="dim">{tx("Manual grants are audited and immediately replace the existing subscription. Use only with documented authorization.")}</p>
        <Loaded load={() => api.superAdminTenants(page)}>{result => <>
          <div className="modgrid">
            {result.items.map((tenant: any) => <div className="modcard" key={tenant.id}>
              <header><strong>{tenant.name}</strong></header>
              <p className="dim">{tenant.slug}</p>
              <p>{tx("Current plan")}: <strong>{tenant.subscription?.planCode ?? tx("None")}</strong></p>
              <p>{tx("Status")}: {tenant.subscription?.status ?? '—'}</p>
              <form method="post" action="/api/super-admin" style={{display:'grid',gap:8}}>
                <input name="action" value="manual-grant" type="hidden"/>
                <input name="tenantId" value={tenant.id} type="hidden"/>
                <label>{tx("Active plan code")}<input name="planCode" required placeholder="enterprise_yearly"/></label>
                <label>{tx("License type")}<select name="status"><option value="active">{tx("Active")}</option><option value="trialing">{tx("Trial")}</option></select></label>
                <label>{tx("Starts at (UTC)")}<input required name="periodStartsAt" type="datetime-local"/></label>
                <label>{tx("Ends at (UTC)")}<input required name="periodEndsAt" type="datetime-local"/></label>
                <label>{tx("Trial end (UTC, trials only)")}<input name="trialEndsAt" type="datetime-local"/></label>
                <label>{tx("Reason for manual license grant")}<input required minLength={10} maxLength={500} name="reason" placeholder={tx("Approved contract/reference")}/></label>
                <button className="btn" type="submit">{tx("Grant manual license")}</button>
              </form>
              {tenant.subscription && !['canceled','expired'].includes(tenant.subscription.status) && <form method="post" action="/api/super-admin" style={{marginBlockStart:12}}>
                <input type="hidden" name="action" value="cancel"/>
                <input type="hidden" name="tenantId" value={tenant.id}/>
                <input type="hidden" name="subscriptionId" value={tenant.subscription.id}/>
                <label>{tx("Cancellation reason")}<input name="reason" required minLength={10} maxLength={500}/></label>
                <button className="btn ghost" type="submit">{tx("Cancel license now")}</button>
              </form>}
            </div>)}
          </div>
          <div style={{display:'flex',gap:16,marginBlockStart:20}}>
            {page > 0 && <a href={`/super-admin?offset=${Math.max(0,page-result.limit)}`}>{tx("Previous")}</a>}
            {result.hasMore && <a href={`/super-admin?offset=${page+result.limit}`}>{tx("Next")}</a>}
          </div>
        </>}</Loaded>
      </section>
      <section className="panel" style={{marginBlockStart:24}}>
        <h2>{tx("Plan audit history")}</h2>
        <Loaded load={api.superAdminAudit}>{entries => <ul>
          {entries.slice(0, 20).map((e: any) => <li key={e.id}>
            <strong>{e.action}</strong> · {e.entityId} · <time>{new Date(e.createdAt).toISOString().slice(0,16).replace('T',' ')}</time> UTC
          </li>)}
        </ul>}</Loaded>
      </section>
    </Page>
  );
}
