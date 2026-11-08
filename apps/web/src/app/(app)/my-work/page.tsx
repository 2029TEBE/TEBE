import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { when, num } from '@/lib/fmt';
import { tr, getLang } from '@/lib/i18n';

export default async function MyWork() {
  const lang = await getLang();
  const t = await tr();
  return (
    <Page title={lang === 'ar' ? 'عملي' : 'My Work'}
          sub={lang === 'ar'
            ? 'الأعمال المسندة إليك، مرتبة حسب ما يعوق بوابات المراحل بدلا من تاريخ الاستحقاق وحده.'
            : 'Everything assigned to you, ranked by what is blocking a gate rather than by due date.'}>
      <Loaded load={api.myWork}>
        {(d) => (
          <>
            <div className="tiles">
              <div className="tile"><span>{t('Open tasks')}</span><strong>{d.tasks.length}</strong>
                <div className="split"><i className={d.tasks.filter((t: any) => t.overdue).length ? 'warnt' : 'dim'}>
                  {d.tasks.filter((t: any) => t.overdue).length} {lang === 'ar' ? 'مهمة متأخرة' : 'overdue'}</i></div></div>
              <div className={`tile${d.approvals.length ? ' alarm' : ''}`}>
                <span>{t('Awaiting your signature')}</span><strong>{d.approvals.length}</strong></div>
              <div className="tile"><span>{t('Criteria to evidence')}</span>
                <strong>{d.criteria.length}</strong></div>
              <div className="tile"><span>{t('Hours logged, 7 days')}</span>
                <strong>{num(d.effortLast7Days, 1)}</strong></div>
            </div>

            <h2 className="sec">{t('Approvals waiting on you')}</h2>
            {d.approvals.length === 0 ? <p className="quietempty">{t('Nothing to sign.')}</p> : (
              <div className="design-table-scroll" role="region" aria-label={t('Approvals')} tabIndex={0}><table>
                <thead><tr><th scope="col">{t('Project')}</th><th scope="col">{t('Gate')}</th><th scope="col">{t('Your role')}</th><th scope="col">{t('Blocking')}</th></tr></thead>
                <tbody>{d.approvals.map((a: any) => (
                  <tr key={a.id}>
                    <td className="num">{a.projectCode}</td><td>{a.gate}</td>
                    <td>{a.isAccountable
                      ? <span className="pill critical">{lang === 'ar' ? 'مسؤول عن الاعتماد' : 'accountable'}</span>
                      : <span className="pill s-closed">{lang === 'ar' ? 'مستشار' : 'consulted'}</span>}</td>
                    <td>{a.criteriaOutstanding > 0
                      ? <span className="warnt">{lang === 'ar' ? `معايير غير مستوفاة: ${a.criteriaOutstanding}` : `${a.criteriaOutstanding} criteria outstanding`}</span>
                      : <span className="good">{lang === 'ar' ? 'جاهز للتوقيع' : 'ready to sign'}</span>}</td>
                  </tr>))}</tbody>
              </table></div>
            )}

            <h2 className="sec">{t('Evidence you owe')}</h2>
            {d.criteria.length === 0 ? <p className="quietempty">{t('Nothing outstanding.')}</p> : (
              <div className="design-table-scroll" role="region" aria-label={t('Outstanding criteria')} tabIndex={0}><table>
                <thead><tr><th scope="col">{t('Project')}</th><th scope="col">{t('Gate')}</th><th scope="col">{t('Criterion')}</th></tr></thead>
                <tbody>{d.criteria.map((c: any) => (
                  <tr key={c.id}><td className="num">{c.projectCode}</td><td>{c.gate}</td>
                    <td>{c.label}</td></tr>))}</tbody>
              </table></div>
            )}

            <h2 className="sec">{t('Tasks')}</h2>
            {d.tasks.length === 0 ? <p className="quietempty">{t('No open tasks.')}</p> : (
              <div className="design-table-scroll" role="region" aria-label={t('Tasks')} tabIndex={0}><table>
                <thead><tr><th scope="col">{t('Project')}</th><th scope="col">{t('Task')}</th><th scope="col">{t('State')}</th><th scope="col">{t('Due')}</th></tr></thead>
                <tbody>{d.tasks.map((t: any) => (
                  <tr key={t.id}>
                    <td className="num">{t.projectCode}</td><td>{t.title}</td>
                    <td><span className={`pill s-${t.state === 'blocked' ? 'open' : 'closed'}`}>
                      {lang === 'ar'
                        ? ({ todo: 'للعمل', in_progress: 'قيد التنفيذ', blocked: 'متعثر', done: 'مكتمل' } as Record<string, string>)[t.state] ?? t.state.replace(/_/g, ' ')
                        : t.state.replace(/_/g, ' ')}</span></td>
                    <td className={t.overdue ? 'crit' : undefined}>{when(t.dueDate, lang)}</td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </>
        )}
      </Loaded>
    </Page>
  );
}
