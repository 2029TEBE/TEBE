import { UiText } from '@/components/UiLocale';
import { pageArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { getFrontendLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { fill, localizedStatus } from '@pmo/contracts';
import { Page, Loaded } from '@/components/Page';
import { when, num } from '@/lib/fmt';
import { tr, getLang } from '@/lib/i18n';

export default async function MyWork() {
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const labelFor = (english: string) => uiLabel(english, locale, pageArabic("my-work", english));
  const t = await tr();
  return (
    <Page title={labelFor("My Work")}
          sub={labelFor("Everything assigned to you, ranked by what is blocking a gate rather than by due date.")}>
      <Loaded load={api.myWork}>
        {(d) => (
          <>
            <div className="tiles">
              <div className="tile"><span><UiText text={t('Open tasks')} /></span><strong>{d.tasks.length}</strong>
                <div className="split"><i className={d.tasks.filter((t: any) => t.overdue).length ? 'warnt' : 'dim'}>
                  {d.tasks.filter((t: any) => t.overdue).length} <UiText text={labelFor("overdue")} /></i></div></div>
              <div className={`tile${d.approvals.length ? ' alarm' : ''}`}>
                <span><UiText text={t('Awaiting your signature')} /></span><strong>{d.approvals.length}</strong></div>
              <div className="tile"><span><UiText text={t('Criteria to evidence')} /></span>
                <strong>{d.criteria.length}</strong></div>
              <div className="tile"><span><UiText text={t('Hours logged, 7 days')} /></span>
                <strong>{num(d.effortLast7Days, 1)}</strong></div>
            </div>

            <h2 className="sec"><UiText text={t('Approvals waiting on you')} /></h2>
            {d.approvals.length === 0 ? <p className="quietempty"><UiText text={t('Nothing to sign.')} /></p> : (
              <div className="design-table-scroll" role="region" aria-label={t('Approvals')} tabIndex={0}><table>
                <thead><tr><th scope="col"><UiText text={t('Project')} /></th><th scope="col"><UiText text={t('Gate')} /></th><th scope="col"><UiText text={t('Your role')} /></th><th scope="col"><UiText text={t('Blocking')} /></th></tr></thead>
                <tbody>{d.approvals.map((a: any) => (
                  <tr key={a.id}>
                    <td className="num">{a.projectCode}</td><td>{a.gate}</td>
                    <td>{a.isAccountable
                      ? <span className="pill critical"><UiText text={labelFor("accountable")} /></span>
                      : <span className="pill s-closed"><UiText text={labelFor("consulted")} /></span>}</td>
                    <td>{a.criteriaOutstanding > 0
                      ? <span className="warnt">{fill(labelFor('{count} criteria outstanding'), { count: a.criteriaOutstanding })}</span>
                      : <span className="good"><UiText text={labelFor("ready to sign")} /></span>}</td>
                  </tr>))}</tbody>
              </table></div>
            )}

            <h2 className="sec"><UiText text={t('Evidence you owe')} /></h2>
            {d.criteria.length === 0 ? <p className="quietempty"><UiText text={t('Nothing outstanding.')} /></p> : (
              <div className="design-table-scroll" role="region" aria-label={t('Outstanding criteria')} tabIndex={0}><table>
                <thead><tr><th scope="col"><UiText text={t('Project')} /></th><th scope="col"><UiText text={t('Gate')} /></th><th scope="col"><UiText text={t('Criterion')} /></th></tr></thead>
                <tbody>{d.criteria.map((c: any) => (
                  <tr key={c.id}><td className="num">{c.projectCode}</td><td>{c.gate}</td>
                    <td>{c.label}</td></tr>))}</tbody>
              </table></div>
            )}

            <h2 className="sec"><UiText text={t('Tasks')} /></h2>
            {d.tasks.length === 0 ? <p className="quietempty"><UiText text={t('No open tasks.')} /></p> : (
              <div className="design-table-scroll" role="region" aria-label={t('Tasks')} tabIndex={0}><table>
                <thead><tr><th scope="col"><UiText text={t('Project')} /></th><th scope="col"><UiText text={t('Task')} /></th><th scope="col"><UiText text={t('State')} /></th><th scope="col"><UiText text={t('Due')} /></th></tr></thead>
                <tbody>{d.tasks.map((t: any) => (
                  <tr key={t.id}>
                    <td className="num">{t.projectCode}</td><td>{t.title}</td>
                    <td><span className={`pill s-${t.state === 'blocked' ? 'open' : 'closed'}`}>
                      <UiText text={localizedStatus('work', t.state, locale)} /></span></td>
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
