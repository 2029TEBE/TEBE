import { pageArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { getFrontendLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { fill, localizedStatus } from '@pmo/contracts';
import { Page, Loaded } from '@/components/Page';
import { when, num } from '@/lib/fmt';
import { formatNumber } from '@/lib/locale-format.mjs';
import { tr } from '@/lib/i18n';

export default async function MyWork() {
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
              <div className="tile"><span>{t('Open tasks')}</span><strong>{formatNumber(d.tasks.length, locale)}</strong>
                <div className="split"><i className={d.tasks.filter((t: any) => t.overdue).length ? 'warnt' : 'dim'}>
                  {formatNumber(d.tasks.filter((t: any) => t.overdue).length, locale)} {labelFor("overdue")}</i></div></div>
              <div className={`tile${d.approvals.length ? ' alarm' : ''}`}>
                <span>{t('Awaiting your signature')}</span><strong>{formatNumber(d.approvals.length, locale)}</strong></div>
              <div className="tile"><span>{t('Criteria to evidence')}</span>
                <strong>{formatNumber(d.criteria.length, locale)}</strong></div>
              <div className="tile"><span>{t('Hours logged, 7 days')}</span>
                <strong>{num(d.effortLast7Days, 1, locale)}</strong></div>
            </div>

            <h2 className="sec">{t('Approvals waiting on you')}</h2>
            {d.approvals.length === 0 ? <p className="quietempty">{t('Nothing to sign.')}</p> : (
              <div className="design-table-scroll" role="region" aria-label={t('Approvals')} tabIndex={0}><table>
                <thead><tr><th scope="col">{t('Project')}</th><th scope="col">{t('Gate')}</th><th scope="col">{t('Your role')}</th><th scope="col">{t('Blocking')}</th></tr></thead>
                <tbody>{d.approvals.map((a: any) => (
                  <tr key={a.id}>
                    <td className="num"><bdi>{a.projectCode}</bdi></td><td><bdi>{a.gate}</bdi></td>
                    <td>{a.isAccountable
                      ? <span className="pill critical">{labelFor("accountable")}</span>
                      : <span className="pill s-closed">{labelFor("consulted")}</span>}</td>
                    <td>{a.criteriaOutstanding > 0 || a.blockers > 0
                      ? <span className="warnt">{a.criteriaOutstanding > 0
                          ? fill(labelFor('{count} criteria outstanding'), { count: formatNumber(a.criteriaOutstanding, locale) })
                          : labelFor('Blocked')}</span>
                      : <span className="good">{labelFor("ready to sign")}</span>}</td>
                  </tr>))}</tbody>
              </table></div>
            )}

            <h2 className="sec">{t('Evidence you owe')}</h2>
            {d.criteria.length === 0 ? <p className="quietempty">{t('Nothing outstanding.')}</p> : (
              <div className="design-table-scroll" role="region" aria-label={t('Outstanding criteria')} tabIndex={0}><table>
                <thead><tr><th scope="col">{t('Project')}</th><th scope="col">{t('Gate')}</th><th scope="col">{t('Criterion')}</th></tr></thead>
                <tbody>{d.criteria.map((c: any) => (
                  <tr key={c.id}><td className="num"><bdi>{c.projectCode}</bdi></td><td><bdi>{c.gate}</bdi></td>
                    <td><bdi>{c.label}</bdi></td></tr>))}</tbody>
              </table></div>
            )}

            <h2 className="sec">{t('Tasks')}</h2>
            {d.tasks.length === 0 ? <p className="quietempty">{t('No open tasks.')}</p> : (
              <div className="design-table-scroll" role="region" aria-label={t('Tasks')} tabIndex={0}><table>
                <thead><tr><th scope="col">{t('Project')}</th><th scope="col">{t('Task')}</th><th scope="col">{t('State')}</th><th scope="col">{t('Due')}</th></tr></thead>
                <tbody>{d.tasks.map((t: any) => (
                  <tr key={t.id}>
                    <td className="num"><bdi>{t.projectCode}</bdi></td><td><bdi>{t.title}</bdi></td>
                    <td><span className={`pill s-${t.state === 'blocked' ? 'open' : 'closed'}`}>
                      {localizedStatus('work', t.state, locale)}</span></td>
                    <td className={t.overdue ? 'crit' : undefined}>{when(t.dueDate, locale)}</td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </>
        )}
      </Loaded>
    </Page>
  );
}
