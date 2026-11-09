import { api } from '@/lib/api';
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
  const t = await tr();
  // Outside <Loaded> on purpose: the create form must render even when the
  // list below is empty, which is precisely when someone needs it.
  const o = await api.createOptions().catch(() => ({ projects: [], people: [] }));
  return (
    <Page title={lang === 'ar' ? 'المنافع' : 'Benefits'}
          sub={lang === 'ar' ? 'تتبع القيمة المتحققة بعد التسليم مقارنة بالمستهدفات وخط الأساس.' : 'Did the project deliver the value it promised? Tracked after handover — the step most tools skip.'}>
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
      <Loaded load={api.benefits} empty={lang === 'ar' ? 'لم يتم تسجيل أي منافع بعد.' : 'No benefits defined yet.'}>
        {(list) => (
          <>
            <section className="design-context" aria-label={lang === 'ar' ? 'ملخص المنافع' : 'Benefits snapshot'}>
              <div className="design-context-head">
                <span className="design-kicker">{lang === 'ar' ? 'تحقق المنافع' : 'BENEFIT REALIZATION'}</span>
                <h2>{lang === 'ar' ? 'حالة المنافع المسجلة' : 'Recorded benefit status'}</h2>
                <p>{lang === 'ar'
                  ? 'تحسب المؤشرات المنافع المعادة من واجهة البيانات المصرح بها بحسب حالتها المسجلة، وليس بحسب تقدير تلقائي للقيمة المتحققة.'
                  : 'These counts reflect the status of benefits returned by the authorized API, not an independently calculated assessment of value realized.'}</p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small>{lang === 'ar' ? 'المنافع المعروضة' : 'Returned benefits'}</small><strong>{list.length}</strong></div>
                <div className="design-metric"><small>{lang === 'ar' ? 'مسجلة كمتحققة' : 'Marked realized'}</small><strong>{list.filter((b: { status: string }) => b.status === 'realized').length}</strong></div>
                <div className="design-metric"><small>{lang === 'ar' ? 'مسجلة كغير متحققة' : 'Marked missed'}</small><strong>{list.filter((b: { status: string }) => b.status === 'missed').length}</strong></div>
              </div>
            </section>
            <div className="design-table-scroll" role="region" aria-label={lang === 'ar' ? 'سجل المنافع' : 'Benefits register'} tabIndex={0}><table>
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
                      {b.direction === 'decrease' && <div className="kind">{lang === 'ar' ? 'القيمة الأقل أفضل' : 'lower is better'}</div>}</td>
                    <td className="num">{num(b.baseline)}</td>
                    <td className="num">{num(b.target)}</td>
                    <td className="num">{num(b.actual)}</td>
                    <td>{b.pctOfTarget == null ? <span className="dim">—</span> : (
                      <><div className="bar" style={{ inlineSize: 110 }}>
                        <i aria-hidden="true" style={{ width: `${benefitBarWidth(Number(b.pctOfTarget))}%` }} /></div>
                        <span className="dim">{lang === 'ar' ? `${b.pctOfTarget}% من المسافة بين خط الأساس والمستهدف` : `${b.pctOfTarget}% of the way from baseline to target`}</span></>)}</td>
                    <td>{when(b.reviewDate, lang)}</td>
                    <td><span className={`pill b-${b.status}`}>{lang === 'ar' ? (({ planned: 'مخطط', in_progress: 'قيد التنفيذ', realized: 'متحقق', missed: 'لم يتحقق' } as Record<string, string>)[b.status] ?? b.status) : b.status.replace('_', ' ')}</span></td>
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
