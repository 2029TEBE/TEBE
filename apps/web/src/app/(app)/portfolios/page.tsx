import { pageArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { getFrontendLocale } from '@/lib/i18n';
import { api, getSession } from '@/lib/api';
import { can, type Capability } from '@pmo/contracts';
import Link from 'next/link';
import { Page, Loaded } from '@/components/Page';
import { NewRecord, Flash } from '@/components/NewRecord';
import { getLang, tr } from '@/lib/i18n';

export default async function PortfoliosPage({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string; new?: string }> }) {
  const { error, done, new: openForm } = await searchParams;
  const t = await tr();
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const labelFor = (english: string) => uiLabel(english, locale, pageArabic("portfolios", english));
  const session = await getSession();
  const capabilities = (session.authenticated ? session.capabilities : []) as Capability[];
  const licensedModules = await api.enabledModules().catch(() => ['core360']);
  const mayCreate = can(capabilities, 'pmoa_manage_projects') && licensedModules.includes('pmo360');
  return (
    <Page title={labelFor("Portfolios & Programs")}
          sub={labelFor("How projects are grouped for funding and management.")}>
      <Flash error={error} done={done} lang={lang} />
      <Loaded load={async () => ({ p: await api.portfolios(), g: await api.programs() })}>
        {({ p, g }) => (
          <>
            {p.length > 0 && <section className="design-context" aria-label={labelFor("Portfolio snapshot")}>
              <div className="design-context-head"><span className="design-kicker">{labelFor("PORTFOLIO STRUCTURE")}</span>
                <h2>{labelFor("Portfolio and programme coverage")}</h2>
                <p>{labelFor("Snapshot of portfolios and programmes returned by the authorized workspace API.")}</p></div>
              <div className="design-summary">
                <div className="design-metric"><small>{labelFor("Portfolios")}</small><strong>{p.length}</strong></div>
                <div className="design-metric"><small>{labelFor("Programmes")}</small><strong>{g.length}</strong></div>
                <div className="design-metric"><small>{labelFor("Portfolios requiring attention")}</small>
                  <strong>{p.filter((pf: any) => pf.health === 'at_risk' || pf.health === 'critical').length}</strong></div>
              </div>
            </section>}
            {p.length === 0 && <section className="panel" style={{ marginBottom: 16 }}> 
              <h2 className="sec" style={{ marginTop: 0 }}>
                {labelFor("Start with your first portfolio")}
              </h2>
              <p className="dim">{labelFor("Create a portfolio for your strategic objective, then a programme to group its projects.")}</p>
              <Link href="/getting-started">{labelFor("View setup guide")}</Link>
            </section>}
            {p.length > 0 && g.length === 0 && <section className="panel" style={{ marginBottom: 16 }}>
              <strong>{labelFor("Next: create a programme")}</strong>
              <p className="dim">{labelFor("Choose the portfolio the programme belongs to, then create your first project.")}</p>
            </section>}
            {mayCreate ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <NewRecord lang={lang} kind="portfolio" title="New portfolio" returnTo="/portfolios" initialOpen={openForm === 'portfolio' || (openForm === 'program' && p.length === 0)}
                intro="A portfolio is a pot of money and strategy that programmes and projects sit under."
                fields={[
                  { name: 'name', label: 'Portfolio name', required: true, minLength: 2, maxLength: 200, placeholder: '2026 Strategic Transformation' },
                  { name: 'health', label: 'Health', type: 'select', required: true, options: [
                    { value: 'on_track', label: 'On track' }, { value: 'at_risk', label: 'At risk' },
                    { value: 'critical', label: 'Critical' }] },
                  { name: 'description', label: 'Description', type: 'textarea' },
                ]} />
              {p.length > 0 && (
                <NewRecord lang={lang} kind="program" title="New programme" returnTo="/portfolios" initialOpen={openForm === 'program'}
                  intro="A programme groups related projects inside one portfolio."
                  fields={[
                    { name: 'portfolioId', label: 'Portfolio', type: 'select', required: true,
                      options: p.map((x: any) => ({ value: x.id, label: x.name })) },
                    { name: 'name', label: 'Programme name', required: true, minLength: 2, maxLength: 200, placeholder: 'Residential Delivery' },
                    { name: 'health', label: 'Health', type: 'select', required: true, options: [
                      { value: 'on_track', label: 'On track' }, { value: 'at_risk', label: 'At risk' },
                      { value: 'critical', label: 'Critical' }] },
                    { name: 'description', label: 'Description', type: 'textarea' },
                  ]} />
              )}
            </div> : <p className="dim">{labelFor("Creating portfolios and programmes requires project-management permission and an enabled PMO module.")}</p>}
            {p.length === 0 ? (
              <div className="empty"><strong>{t('No portfolios yet')}</strong>
                <p>{mayCreate
                  ? (labelFor("Create your first portfolio above, then add a programme and projects."))
                  : (labelFor("Ask an authorized administrator to create the first portfolio."))}</p></div>
            ) : (
            <div className="design-table-scroll" role="region" aria-label={labelFor("Portfolio register")} tabIndex={0}><table>
              <thead><tr><th scope="col">{t('Portfolio')}</th><th scope="col">{t('Health')}</th><th scope="col">{t('Programs')}</th></tr></thead>
              <tbody>
                {p.map((pf: any) => (
                  <tr key={pf.id}>
                    <td><strong><bdi>{pf.name}</bdi></strong>
                      {pf.description && <div className="dim"><bdi>{pf.description}</bdi></div>}</td>
                    <td><span className={`pill ${pf.health}`}>{lang === 'ar' ? (({ on_track: 'وفق الخطة', at_risk: 'يحتاج انتباها', critical: 'حرج' } as Record<string, string>)[pf.health] ?? pf.health.replace('_', ' ')) : pf.health.replace('_', ' ')}</span></td>
                    <td>{g.filter((pg: any) => pg.portfolioId === pf.id).length ?
                      g.filter((pg: any) => pg.portfolioId === pf.id).map((pg: any) =>
                        <div key={pg.id}><Link href={`/projects?program=${encodeURIComponent(pg.id)}`}>
                          <bdi>{pg.name}</bdi>
                        </Link>{' '}{mayCreate && <Link href={`/projects?new=project&program=${encodeURIComponent(pg.id)}`}>
                          {labelFor("Add project")}
                        </Link>}</div>) : <span className="dim">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>)}
          </>
        )}
      </Loaded>
    </Page>
  );
}
