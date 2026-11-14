import { UiText } from '@/components/UiLocale';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { NewRecord, Flash } from '@/components/NewRecord';
import { tr, getLang } from '@/lib/i18n';

const band = (i: number, n: number) =>
  i >= 4 && n >= 4 ? 'manage' : i >= 4 ? 'satisfy' : n >= 4 ? 'inform' : 'monitor';

export default async function Stakeholders({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;
  const lang = await getLang();
  const t = await tr();
  // Outside <Loaded> on purpose: the create form must render even when the
  // list below is empty, which is precisely when someone needs it.
  const o = await api.createOptions().catch(() => ({ projects: [], people: [] }));
  return (
    <Page title={lang === 'ar' ? 'أصحاب المصلحة' : 'Stakeholders'} sub={lang === 'ar' ? 'تصنيف أصحاب المصلحة وفق التأثير والاهتمام لتحديد مستوى التواصل المناسب.' : 'Who can affect delivery, and how closely each needs managing. Placement comes from influence × interest.'}>
      <Flash error={error} done={done} lang={lang} />
      <NewRecord lang={lang} kind="stakeholder" title="New stakeholder" cta="Add stakeholder" returnTo="/stakeholders"
        intro="Influence and interest place someone on the engagement grid, so both are worth setting even when they are a guess."
        fields={[
                { name: 'name', label: 'Name', required: true, placeholder: 'Fatima Al-Zahrani' },
                { name: 'organisation', label: 'Organisation', placeholder: 'Ministry of Housing' },
                { name: 'role', label: 'Role', placeholder: 'Regulatory approver' },
                { name: 'projectId', label: 'Project', type: 'select',
                  options: o.projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })) },
                { name: 'influence', label: 'Influence (1–5)', type: 'number', min: 1, max: 5, step: 1, hint: '5 = can stop the project' },
                { name: 'interest', label: 'Interest (1–5)', type: 'number', min: 1, max: 5, step: 1, hint: '5 = follows it closely' },
                { name: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com' },
                { name: 'phone', label: 'Phone' },
                { name: 'isExternal', label: 'External to the organisation', type: 'checkbox' },
              ]} />
      <Loaded load={api.stakeholders} empty={lang === 'ar' ? 'لم يتم تسجيل أصحاب مصلحة بعد.' : 'No stakeholders recorded yet.'}>
        {(list) => (
          <>
            <section className="design-context" aria-label={lang === 'ar' ? 'ملخص أصحاب المصلحة' : 'Stakeholder overview'}>
              <div className="design-context-head">
                <span className="design-kicker"><UiText text={lang === 'ar' ? 'إدارة أصحاب المصلحة' : 'STAKEHOLDER ENGAGEMENT'} /></span>
                <h2><UiText text={lang === 'ar' ? 'ملخص أصحاب المصلحة المسجلين' : 'Registered stakeholder snapshot'} /></h2>
                <p><UiText text={lang === 'ar'
                  ? 'تستند المؤشرات إلى أصحاب المصلحة المعادين من واجهة البيانات المصرح بها فقط، ولا تعني أنها تشمل جميع الأطراف في المؤسسة.'
                  : 'This snapshot covers only stakeholders returned by the authorized API; it may not represent every party across the organization.'} /></p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'المسجلون' : 'Returned stakeholders'} /></small><strong>{list.length}</strong></div>
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'تأثير واهتمام مرتفعان' : 'High influence and interest'} /></small><strong>{list.filter((s: { influence?: number | null; interest?: number | null }) => Number(s.influence) >= 4 && Number(s.interest) >= 4).length}</strong></div>
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'جهات خارجية' : 'External stakeholders'} /></small><strong>{list.filter((s: { isExternal?: boolean }) => s.isExternal === true).length}</strong></div>
              </div>
            </section>
            <div className="design-table-scroll" role="region" aria-label={lang === 'ar' ? 'سجل أصحاب المصلحة' : 'Stakeholder register'} tabIndex={0}><table>
              <thead><tr><th scope="col"><UiText text={t('Stakeholder')} /></th><th scope="col"><UiText text={t('Organisation')} /></th><th scope="col"><UiText text={t('Role')} /></th><th scope="col"><UiText text={t('Project')} /></th><th scope="col"><UiText text={t('Influence')} /></th><th scope="col"><UiText text={t('Interest')} /></th><th scope="col"><UiText text={t('Handling')} /></th></tr></thead>
              <tbody>{list.map((s: any) => {
                const b = s.influence && s.interest ? band(s.influence, s.interest) : null;
                return (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong>
                      {s.email && <div className="dim">{s.email}</div>}</td>
                    <td>{s.organisation ?? '—'}
                      {s.isExternal && <div><span className="kind k-issue"><UiText text={lang === 'ar' ? 'خارجي' : 'external'} /></span></div>}</td>
                    <td className="dim">{s.role ?? '—'}</td>
                    <td className="num">{s.projectCode ?? '—'}</td>
                    <td className="num">{s.influence ?? '—'}</td>
                    <td className="num">{s.interest ?? '—'}</td>
                    <td>{b ? <span className={`pill sh-${b}`}>{lang === 'ar' ? ({ manage: 'إدارة مباشرة', satisfy: 'الحفاظ على الرضا', inform: 'إبلاغ مستمر', monitor: 'متابعة' } as Record<string, string>)[b] : ({ manage: 'manage closely', satisfy: 'keep satisfied', inform: 'keep informed', monitor: 'monitor' } as Record<string, string>)[b]}</span> : <span className="dim">—</span>}</td>
                  </tr>);
              })}</tbody>
            </table></div>
            <details className="explain">
              <summary><UiText text={t('What the handling column means')} /></summary>
              {lang === 'ar' ? <p>تحدد مصفوفة التأثير والاهتمام أسلوب التواصل: التأثير والاهتمام المرتفعان يتطلبان إدارة مباشرة، والتأثير المرتفع مع اهتمام منخفض يستلزم الحفاظ على الرضا، والاهتمام المرتفع مع تأثير منخفض يتطلب إبلاغا مستمرا، أما المستويات المنخفضة فتحتاج إلى المتابعة الدورية.</p> : <p><UiText text={t('The standard influence/interest grid. High influence and high interest means')} />
                <strong> <UiText text={" manage closely"} /></strong> <UiText text={" — they can stop the project and they care. High influence, low interest means "} /><strong><UiText text={"keep satisfied"} /></strong> <UiText text={" — do not surprise them. Low influence, high interest means "} /><strong><UiText text={"keep informed"} /></strong><UiText text={". Neither means"} /><strong> <UiText text={" monitor"} /></strong><UiText text={". It decides who gets a phone call and who gets a newsletter."} /></p>}
            </details>
          </>
        )}
      </Loaded>
    </Page>
  );
}
