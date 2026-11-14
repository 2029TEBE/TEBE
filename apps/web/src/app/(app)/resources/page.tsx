import { UiText } from '@/components/UiLocale';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { NewRecord, Flash } from '@/components/NewRecord';
import { num } from '@/lib/fmt';
import { tr, getLang } from '@/lib/i18n';

/** Visual bar width only; over-allocated totals remain visible in text. */
const capacityBarFill = (pct: number) =>
  Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;

export default async function Resources({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;
  const lang = await getLang();
  const t = await tr();
  // Outside <Loaded> on purpose: the create form must render even when the
  // list below is empty, which is precisely when someone needs it.
  const o = await api.createOptions().catch(() => ({ projects: [], people: [] }));
  return (
    <Page title={lang === 'ar' ? 'الموارد' : 'Resources'}
          sub={lang === 'ar' ? 'توزيع الأفراد على المشاريع ورصد الحمل الزائد قبل أن يؤثر في التنفيذ.' : 'Who is working on what, and who is over-committed. Over-allocation is the earliest warning of slippage.'}>
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
            <section className="design-context" aria-label={lang === 'ar' ? 'ملخص طاقة الموارد' : 'Resource capacity snapshot'}>
              <div className="design-context-head">
                <span className="design-kicker"><UiText text={lang === 'ar' ? 'طاقة التنفيذ' : 'DELIVERY CAPACITY'} /></span>
                <h2><UiText text={lang === 'ar' ? 'ملخص طاقة الأفراد' : 'People capacity overview'} /></h2>
                <p><UiText text={lang === 'ar'
                  ? 'المؤشرات مأخوذة من سجلات الموارد المعادة من واجهة البيانات المصرح بها؛ ولا تمثل بالضرورة جميع أفراد المؤسسة.'
                  : 'Metrics describe only resource records returned by the authorized API, not necessarily the entire organization.'} /></p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'الأفراد المعروضون' : 'Returned people'} /></small><strong>{d.people.length}</strong></div>
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'تجاوزوا 100% تخصيصا' : 'Allocated above 100%'} /></small><strong>{d.people.filter((p: { allocatedPct: number }) => p.allocatedPct > 100).length}</strong></div>
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'سجلات التخصيص المعروضة' : 'Returned allocations'} /></small><strong>{d.byProject.length}</strong></div>
              </div>
            </section>
            <h2 className="sec" style={{ marginTop: 0 }}><UiText text={t('Capacity')} /></h2>
            <div className="design-table-scroll" role="region" aria-label={t('Capacity')} tabIndex={0}><table>
              <thead><tr><th scope="col"><UiText text={t('Person')} /></th><th scope="col"><UiText text={t('Projects')} /></th><th scope="col"><UiText text={t('Allocated')} /></th><th scope="col"><UiText text={t('Load')} /></th><th scope="col"><UiText text={t('Hours, 7 days')} /></th></tr></thead>
              <tbody>
                {d.people.map((p: any) => {
                  const over = p.allocatedPct > 100;
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td className="num">{p.projects}</td>
                      <td className="num"><span className={over ? 'crit' : p.allocatedPct >= 90 ? 'warnt' : 'good'}>
                        {p.allocatedPct}%</span></td>
                      <td>
                        <div className="bar" style={{ inlineSize: 180 }}>
                          <i className={over ? 'over' : undefined}
                             aria-hidden="true" style={{ width: `${capacityBarFill(p.allocatedPct)}%` }} />
                        </div>
                        {over && <div className="crit"><UiText text={lang === 'ar' ? 'تجاوز الطاقة بنسبة' : 'over-committed by'} /> {p.allocatedPct - 100}%</div>}
                      </td>
                      <td className="num">{num(p.hoursLast7, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>

            <h2 className="sec"><UiText text={t('Allocations by project')} /></h2>
            <div className="design-table-scroll" role="region" aria-label={t('Allocations by project')} tabIndex={0}><table>
              <thead><tr><th scope="col"><UiText text={t('Project')} /></th><th scope="col"><UiText text={t('Person')} /></th><th scope="col"><UiText text={t('Role')} /></th><th scope="col"><UiText text={t('Allocation')} /></th></tr></thead>
              <tbody>
                {d.byProject.map((a: any, i: number) => (
                  <tr key={i}>
                    <td className="num">{a.projectCode}</td>
                    <td>{a.name}</td>
                    <td className="dim">{a.role}</td>
                    <td className="num">{a.allocationPct}%</td>
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
