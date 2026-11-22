import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { NewRecord, Flash } from '@/components/NewRecord';
import { num } from '@/lib/fmt';
import { formatNumber } from '@/lib/locale-format.mjs';
import { tr, getLang, getFrontendLocale } from '@/lib/i18n';

/** Visual bar width only; over-allocated totals remain visible in text. */
const capacityBarFill = (pct: number) =>
  Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
const capacityValue = (pct: unknown): pct is number =>
  typeof pct === 'number' && Number.isFinite(pct) && pct >= 0;

export default async function Resources({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const t = await tr();
  // Outside <Loaded> on purpose: the create form must render even when the
  // list below is empty, which is precisely when someone needs it.
  const o = await api.createOptions().catch(() => ({ projects: [], people: [] }));
  return (
    <Page title={t('Resources')}
          sub={t('Who is working on what, and who is over-committed. Over-allocation is the earliest warning of slippage.')}>
      <Flash error={error} done={done} lang={lang} />
      <NewRecord lang={lang} kind="allocation" title="New allocation" cta="Allocate" returnTo="/resources"
        intro="Allocating the same person past 100% across projects is what over-commitment looks like before anyone feels it."
        fields={[
                { name: 'userId', label: 'Person', type: 'select', required: true,
                  options: o.people.map((p: any) => ({ value: p.id, label: p.name })) },
                { name: 'projectId', label: 'Project', type: 'select', required: true,
                  options: o.projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })) },
                { name: 'role', label: 'Role', required: true, placeholder: 'Project Manager' },
                { name: 'allocationPct', label: 'Allocation %', type: 'number', required: true, min: 1, max: 100, step: 1, hint: '1–100' },
                { name: 'startDate', label: 'From', type: 'date' },
                { name: 'endDate', label: 'To', type: 'date' },
              ]} />
      <Loaded load={api.resources}>
        {(d) => (
          <>
            <section className="design-context" aria-label={t('Resource capacity snapshot')}>
              <div className="design-context-head">
                <span className="design-kicker">{t('DELIVERY CAPACITY')}</span>
                <h2>{t('People capacity overview')}</h2>
                <p>{t('Metrics describe only resource records returned by the authorized API, not necessarily the entire organization.')}</p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small>{t('Returned people')}</small><strong>{formatNumber(d.people.length, locale)}</strong></div>
                <div className="design-metric"><small>{t('Allocated above 100%')}</small><strong>{formatNumber(d.people.filter((p: { allocatedPct: number }) => capacityValue(p.allocatedPct) && p.allocatedPct > 100).length, locale)}</strong></div>
                <div className="design-metric"><small>{t('Returned allocations')}</small><strong>{formatNumber(d.byProject.length, locale)}</strong></div>
              </div>
            </section>
            <h2 className="sec" style={{ marginTop: 0 }}>{t('Capacity')}</h2>
            <div className="design-table-scroll" role="region" aria-label={t('Capacity')} tabIndex={0}><table>
              <thead><tr><th scope="col">{t('Person')}</th><th scope="col">{t('Projects')}</th><th scope="col">{t('Allocated')}</th><th scope="col">{t('Load')}</th><th scope="col">{t('Hours, 7 days')}</th></tr></thead>
              <tbody>
                {d.people.map((p: any) => {
                  const hasAllocation = capacityValue(p.allocatedPct);
                  const over = hasAllocation && p.allocatedPct > 100;
                  return (
                    <tr key={p.id}>
                      <td><strong><bdi>{p.name}</bdi></strong></td>
                      <td className="num">{num(p.projects, 0, locale)}</td>
                      <td className="num"><span className={over ? 'crit' : hasAllocation && p.allocatedPct >= 90 ? 'warnt' : hasAllocation ? 'good' : 'dim'}>
                        {hasAllocation ? `${num(p.allocatedPct, 0, locale)}%` : '—'}</span></td>
                      <td>
                        <div className="bar" style={{ inlineSize: 180 }}>
                          <i className={over ? 'over' : undefined}
                             aria-hidden="true" style={{ width: `${capacityBarFill(p.allocatedPct)}%` }} />
                        </div>
                        {over && <div className="crit">{t('over-committed by')} {num(p.allocatedPct - 100, 0, locale)}%</div>}
                      </td>
                      <td className="num">{num(p.hoursLast7, 1, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>

            <h2 className="sec">{t('Allocations by project')}</h2>
            <div className="design-table-scroll" role="region" aria-label={t('Allocations by project')} tabIndex={0}><table>
              <thead><tr><th scope="col">{t('Project')}</th><th scope="col">{t('Person')}</th><th scope="col">{t('Role')}</th><th scope="col">{t('Allocation')}</th></tr></thead>
              <tbody>
                {d.byProject.map((a: any, i: number) => (
                  <tr key={i}>
                    <td className="num"><bdi>{a.projectCode}</bdi></td>
                    <td><bdi>{a.name}</bdi></td>
                    <td className="dim"><bdi>{a.role}</bdi></td>
                    <td className="num">{capacityValue(a.allocationPct) ? `${num(a.allocationPct, 0, locale)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
        )}
      </Loaded>
    </Page>
  );
}
