import { pageArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { getFrontendLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { fill, localizedStatus } from '@pmo/contracts';
import { Page, Loaded } from '@/components/Page';
import { NewRecord, Flash } from '@/components/NewRecord';
import { num, when } from '@/lib/fmt';
import { tr, getLang } from '@/lib/i18n';

/** Clamp only the bar fill: a benefit can legitimately exceed its target. */
const benefitBarWidth = (pct: number) =>
  Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;

export default async function Benefits({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const labelFor = (english: string) => uiLabel(english, locale, pageArabic("benefits", english));
  const t = await tr();
  // Outside <Loaded> on purpose: the create form must render even when the
  // list below is empty, which is precisely when someone needs it.
  const o = await api.createOptions().catch(() => ({ projects: [], people: [] }));
  return (
    <Page title={labelFor("Benefits")}
          sub={labelFor("Did the project deliver the value it promised? Tracked after handover — the step most tools skip.")}>
      <Flash error={error} done={done} lang={lang} />
      <NewRecord lang={lang} kind="benefit" title="New benefit" cta="Add benefit" returnTo="/benefits"
        intro="A benefit is the value the project promised. Recording the measure and its baseline now is what makes it checkable after handover."
        fields={[
                { name: 'name', label: 'Benefit', required: true, placeholder: 'Additional rental income' },
                { name: 'measure', label: 'Measure', required: true, placeholder: 'Annual rental income (SAR)' },
                { name: 'projectId', label: 'Project', type: 'select',
                  options: o.projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })) },
                { name: 'baseline', label: 'Baseline', type: 'number', hint: 'Where it stands today' },
                { name: 'target', label: 'Target', type: 'number' },
                { name: 'actual', label: 'Actual', type: 'number', hint: 'Leave blank until measured' },
                { name: 'status', label: 'Status', type: 'select', options: [
                  { value: 'planned', label: 'Planned' }, { value: 'in_progress', label: 'In progress' },
                  { value: 'realized', label: 'Realised' }, { value: 'missed', label: 'Missed' }] },
                { name: 'reviewDate', label: 'Review date', type: 'date' },
                { name: 'ownerId', label: 'Owner', type: 'select',
                  options: o.people.map((p: any) => ({ value: p.id, label: p.name })) },
              ]} />
      <Loaded load={api.benefits} empty={labelFor("No benefits defined yet.")}>
        {(list) => (
          <>
            <section className="design-context" aria-label={labelFor("Benefits snapshot")}>
              <div className="design-context-head">
                <span className="design-kicker">{labelFor("BENEFIT REALIZATION")}</span>
                <h2>{labelFor("Recorded benefit status")}</h2>
                <p>{labelFor("These counts reflect the status of benefits returned by the authorized API, not an independently calculated assessment of value realized.")}</p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small>{labelFor("Returned benefits")}</small><strong>{list.length}</strong></div>
                <div className="design-metric"><small>{labelFor("Marked realized")}</small><strong>{list.filter((b: { status: string }) => b.status === 'realized').length}</strong></div>
                <div className="design-metric"><small>{labelFor("Marked missed")}</small><strong>{list.filter((b: { status: string }) => b.status === 'missed').length}</strong></div>
              </div>
            </section>
            <div className="design-table-scroll" role="region" aria-label={labelFor("Benefits register")} tabIndex={0}><table>
              <thead><tr>
                <th scope="col">{t('Benefit')}</th><th scope="col">{t('Project')}</th><th scope="col">{t('Measure')}</th><th scope="col">{t('Baseline')}</th>
                <th scope="col">{t('Target')}</th><th scope="col">{t('Actual')}</th><th scope="col">{t('Progress')}</th><th scope="col">{t('Review')}</th><th scope="col">{t('Status')}</th>
              </tr></thead>
              <tbody>
                {list.map((b: any) => (
                  <tr key={b.id}>
                    <td><strong>{b.name}</strong>
                      {b.owner && <div className="dim">{b.owner}</div>}</td>
                    <td className="num">{b.projectCode ?? '—'}</td>
                    <td className="dim">{b.measure}
                      {b.direction === 'decrease' && <div className="kind">{labelFor("lower is better")}</div>}</td>
                    <td className="num">{num(b.baseline, 0, locale)}</td>
                    <td className="num">{num(b.target, 0, locale)}</td>
                    <td className="num">{num(b.actual, 0, locale)}</td>
                    <td>{b.pctOfTarget == null ? <span className="dim">—</span> : (
                      <><div className="bar" style={{ inlineSize: 110 }}>
                        <i aria-hidden="true" style={{ width: `${benefitBarWidth(Number(b.pctOfTarget))}%` }} /></div>
                        <span className="dim">{fill(labelFor('{pct}% of the way from baseline to target'), {pct: b.pctOfTarget})}</span></>)}</td>
                    <td>{when(b.reviewDate, locale)}</td>
                    <td><span className={`pill b-${b.status}`}>{localizedStatus('benefits', b.status, locale)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <details className="explain">
              <summary>{t('Why benefits are tracked separately from delivery')}</summary>
              <p>{t('A project can finish on time and on budget and still deliver nothing of value. Benefits have their own owner and their own review date — often a year or more after handover — so the question &ldquo;was this worth doing?&rdquo; still gets asked once the delivery team has moved on. Baseline is where you started, target is what you promised, actual is where you are.')}</p>
            </details>
          </>
        )}
      </Loaded>
    </Page>
  );
}
