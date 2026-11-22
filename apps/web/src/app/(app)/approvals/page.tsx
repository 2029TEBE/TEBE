import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { when } from '@/lib/fmt';
import { formatNumber } from '@/lib/locale-format.mjs';
import { tr, getFrontendLocale } from '@/lib/i18n';

export default async function Approvals() {
  const locale = await getFrontendLocale();
  const t = await tr();
  return (
    <Page title={t('Approvals')} sub={t('Every signature the platform is waiting on, and whether the gate is actually ready to sign.')}>
      <Loaded load={api.approvals} empty={t('Nothing awaiting approval.')}>
        {(list) => {
          const pending = list.filter((a: any) => a.decision === 'pending');
          const ready = pending.filter((a: any) => a.criteriaOutstanding === 0 && a.blockers === 0);
          return (
            <>
              <div className="tiles">
                <div className={`tile${pending.length ? ' alarm' : ''}`}>
                  <span>{t('Awaiting signature')}</span><strong>{formatNumber(pending.length, locale)}</strong></div>
                <div className="tile"><span>{t('Ready to sign now')}</span><strong>{formatNumber(ready.length, locale)}</strong>
                  <div className="split"><i className="dim">{t('criteria met, nothing blocking')}</i></div></div>
                <div className="tile"><span>{t('Blocked')}</span><strong>{formatNumber(pending.length - ready.length, locale)}</strong>
                  <div className="split"><i className="dim">{t('cannot sign yet')}</i></div></div>
              </div>
              <section className="design-context" aria-label={t('Approval readiness')}>
                <div className="design-context-head">
                  <span className="design-kicker">{t('Approval readiness')}</span>
                  <p>{t('A pending signature is not the same as a signable gate. Review outstanding criteria and blockers in the queue before taking action.')}</p>
                </div>
                <div className="design-context-actions">
                  <span className="design-key"><i className="design-key-dot good" />{formatNumber(ready.length, locale)} {t('Ready to sign now')}</span>
                  <span className="design-key"><i className="design-key-dot warn" />{formatNumber(pending.length - ready.length, locale)} {t('Blocked')}</span>
                  <a className="btn ghost" href="/governance">{t('Review stage gates')}</a>
                </div>
              </section>
              <h2 className="sec">{t('Queue')}</h2>
              <div className="design-table-scroll" role="region" aria-label={t('Queue')} tabIndex={0}><table>
                <thead><tr><th scope="col">{t('Project')}</th><th scope="col">{t('Gate')}</th><th scope="col">{t('Approver')}</th><th scope="col">{t('Role')}</th><th scope="col">{t('Ready?')}</th><th scope="col">{t('Decision')}</th></tr></thead>
                <tbody>{list.map((a: any) => {
                  const blocked = a.criteriaOutstanding > 0 || a.blockers > 0;
                  return (
                    <tr key={a.id}>
                      <td><strong><bdi>{a.projectCode}</bdi></strong><div className="dim"><bdi>{a.projectName}</bdi></div></td>
                      <td><bdi>{a.gate}</bdi></td>
                      <td>{a.approver ? <bdi>{a.approver}</bdi> : <span className="dim">{t('unassigned')}</span>}</td>
                      <td>{a.isAccountable
                        ? <span className="pill critical">{t('accountable')}</span>
                        : <span className="pill s-closed">{t('consulted')}</span>}</td>
                      <td>{a.decision !== 'pending' ? <span className="dim">—</span>
                        : blocked
                          ? <span className="crit">
                              {a.criteriaOutstanding > 0 && `${formatNumber(a.criteriaOutstanding, locale)} ${t('criteria left')}`}
                              {a.criteriaOutstanding > 0 && a.blockers > 0 && ', '}
                              {a.blockers > 0 && `${formatNumber(a.blockers, locale)} ${t(a.blockers > 1 ? 'blockers' : 'blocker')}`}
                            </span>
                          : <span className="good">{t('ready')}</span>}</td>
                      <td>{a.decision === 'pending'
                        ? <span className="pill at_risk">{t('pending')}</span>
                        : <><span className="pill on_track">{t(a.decision)}</span>
                            <div className="dim">{when(a.decidedAt, locale)}</div></>}</td>
                    </tr>);
                })}</tbody>
              </table></div>
              <details className="explain">
                <summary>{t('Why an approval can be “pending” but not signable')}</summary>
                <p>{t('A signature is only meaningful once the evidence exists. The platform will not let an approver sign a gate whose checklist is incomplete or which has an open blocker pointed at it — so “pending” and “ready” are different states, and this queue tells the approver which of the two they are looking at.')}</p>
              </details>
            </>
          );
        }}
      </Loaded>
    </Page>
  );
}
