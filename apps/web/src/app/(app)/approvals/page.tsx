import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { when } from '@/lib/fmt';
import { tr, getFrontendLocale } from '@/lib/i18n';

export default async function Approvals() {
  const locale = await getFrontendLocale();
  const t = await tr();
  return (
    <Page title="Approvals" sub="Every signature the platform is waiting on, and whether the gate is actually ready to sign.">
      <Loaded load={api.approvals} empty="Nothing awaiting approval.">
        {(list) => {
          const pending = list.filter((a: any) => a.decision === 'pending');
          const ready = pending.filter((a: any) => a.criteriaOutstanding === 0 && a.blockers === 0);
          return (
            <>
              <div className="tiles">
                <div className={`tile${pending.length ? ' alarm' : ''}`}>
                  <span>{t('Awaiting signature')}</span><strong>{pending.length}</strong></div>
                <div className="tile"><span>{t('Ready to sign now')}</span><strong>{ready.length}</strong>
                  <div className="split"><i className="dim">{t('criteria met, nothing blocking')}</i></div></div>
                <div className="tile"><span>{t('Blocked')}</span><strong>{pending.length - ready.length}</strong>
                  <div className="split"><i className="dim">{t('cannot sign yet')}</i></div></div>
              </div>
              <section className="design-context" aria-label={t('Approval readiness')}>
                <div className="design-context-head">
                  <span className="design-kicker">{t('Approval readiness')}</span>
                  <p>{t('A pending signature is not the same as a signable gate. Review outstanding criteria and blockers in the queue before taking action.')}</p>
                </div>
                <div className="design-context-actions">
                  <span className="design-key"><i className="design-key-dot good" />{ready.length} {t('Ready to sign now')}</span>
                  <span className="design-key"><i className="design-key-dot warn" />{pending.length - ready.length} {t('Blocked')}</span>
                  <a className="btn ghost" href="/governance">{t('Review stage gates')}</a>
                </div>
              </section>
              <h2 className="sec">{t('Queue')}</h2>
              <div className="design-table-scroll" role="region" aria-label={t('Queue')} tabIndex={0}><table>
                <thead><tr><th>{t('Project')}</th><th>{t('Gate')}</th><th>{t('Approver')}</th><th>{t('Role')}</th><th>{t('Ready?')}</th><th>{t('Decision')}</th></tr></thead>
                <tbody>{list.map((a: any) => {
                  const blocked = a.criteriaOutstanding > 0 || a.blockers > 0;
                  return (
                    <tr key={a.id}>
                      <td><strong>{a.projectCode}</strong><div className="dim">{a.projectName}</div></td>
                      <td>{a.gate}</td>
                      <td>{a.approver ?? <span className="dim">{t('unassigned')}</span>}</td>
                      <td>{a.isAccountable
                        ? <span className="pill critical">{t('accountable')}</span>
                        : <span className="pill s-closed">{t('consulted')}</span>}</td>
                      <td>{a.decision !== 'pending' ? <span className="dim">—</span>
                        : blocked
                          ? <span className="crit">
                              {a.criteriaOutstanding > 0 && `${a.criteriaOutstanding} ${t('criteria left')}`}
                              {a.criteriaOutstanding > 0 && a.blockers > 0 && ', '}
                              {a.blockers > 0 && `${a.blockers} ${t(a.blockers > 1 ? 'blockers' : 'blocker')}`}
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
