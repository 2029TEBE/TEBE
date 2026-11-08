import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { when } from '@/lib/fmt';
import { tr, getLang, term } from '@/lib/i18n';

export default async function Decisions() {
  const lang = await getLang();
  const t = await tr();
  return (
    <Page title={lang === 'ar' ? 'سجل القرارات' : 'Decisions'} sub={lang === 'ar' ? 'القرارات الموثقة وأصحابها ومراحل الاعتماد المرتبطة بها لسهولة المراجعة والتدقيق.' : 'The decision log. Every recorded decision, who owned it, and which gate it was taken at — the record auditors ask for first.'}>
      <Loaded load={api.decisions} empty={lang === 'ar' ? 'لا توجد قرارات مسجلة بعد. تُوثق القرارات عند إغلاق مراحل الاعتماد.' : 'No decisions recorded yet. They are logged as you close gates.'}>
        {(list) => (
          <>
            <section className="design-context" aria-label={lang === 'ar' ? 'ملخص سجل القرارات' : 'Decision register summary'}>
              <div className="design-context-head">
                <span className="design-kicker">{lang === 'ar' ? 'حوكمة القرارات' : 'DECISION GOVERNANCE'}</span>
                <h2>{lang === 'ar' ? 'نظرة عامة على القرارات المسجلة' : 'Recorded decisions overview'}</h2>
                <p>{lang === 'ar'
                  ? 'تعكس المؤشرات القرارات المسترجعة من واجهة البيانات المصرح بها فقط، وليس بالضرورة جميع قرارات المؤسسة.'
                  : 'Counts reflect only the decisions returned by the authorized API, not necessarily every decision across the organization.'}</p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small>{lang === 'ar' ? 'القرارات المعروضة' : 'Returned decisions'}</small><strong>{list.length}</strong></div>
                <div className="design-metric"><small>{lang === 'ar' ? 'مرتبطة ببوابة اعتماد' : 'Linked to a gate'}</small><strong>{list.filter((d: { atGate?: string | null }) => Boolean(d.atGate)).length}</strong></div>
                <div className="design-metric"><small>{lang === 'ar' ? 'ذات مسؤول محدد' : 'With an owner'}</small><strong>{list.filter((d: { owner?: string | null }) => Boolean(d.owner)).length}</strong></div>
              </div>
            </section>
            <div className="design-table-scroll" role="region" aria-label={lang === 'ar' ? 'جدول القرارات' : 'Decision register'} tabIndex={0}><table>
              <thead><tr><th scope="col">{t('Decision')}</th><th scope="col">{t('Project')}</th><th scope="col">{t('Taken at')}</th><th scope="col">{t('Owner')}</th><th scope="col">{t('Date')}</th><th scope="col">{t('State')}</th></tr></thead>
            <tbody>{list.map((d: any) => (
              <tr key={d.id}>
                <td><strong>{d.title}</strong>{d.detail && <div className="dim">{d.detail}</div>}</td>
                <td className="num">{d.projectCode}</td>
                <td>{d.atGate ?? <span className="dim">{lang === 'ar' ? 'غير مرتبط بمرحلة' : 'not gate-linked'}</span>}</td>
                <td>{d.owner ?? <span className="dim">{lang === 'ar' ? 'غير معين' : 'unassigned'}</span>}</td>
                <td>{when(d.decidedAt, lang)}</td>
                <td><span className={`pill s-${d.status}`}>{term(t, d.status)}</span></td>
              </tr>))}</tbody>
          </table></div>
          </>
        )}
      </Loaded>
    </Page>
  );
}
