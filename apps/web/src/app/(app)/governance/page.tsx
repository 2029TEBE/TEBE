import { UiText } from '@/components/UiLocale';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { tr, getLang } from '@/lib/i18n';

export default async function GovernancePage() {
  const lang = await getLang();
  const t = await tr();
  return (
    <Page title="Stage Gates" sub="Which projects are stuck, at which gate, and why. Open one to tick criteria, sign approvals and pass the gate.">
      <Loaded load={api.gates} empty="No projects have an active gate.">
        {(gates) => (
          <>
            <section className="design-context" aria-label={t('Stage gate overview')}>
              <div className="design-context-head"><span className="design-kicker"><UiText text={t('Stage gates')} /></span>
                <h2><UiText text={t('Governance readiness')} /></h2>
                <p><UiText text={t('Gate readiness comes from the authorized checklist and stage decision conditions. Review the source before passing a gate.')} /></p></div>
              <div className="design-summary">
                <div className="design-metric"><small><UiText text={t('Active gates')} /></small><strong>{gates.length}</strong></div>
                <div className="design-metric"><small><UiText text={t('Ready to pass')} /></small><strong>{gates.filter(g => g.mayPass).length}</strong></div>
                <div className="design-metric"><small><UiText text={t('Not ready')} /></small><strong>{gates.filter(g => !g.mayPass).length}</strong></div>
              </div>
            </section>
            <div className="design-table-scroll" role="region" aria-label={t('Stage gates')} tabIndex={0}><table>
            <thead>
              <tr><th><UiText text={t('Project')} /></th><th><UiText text={t('Current gate')} /></th><th><UiText text={t('Checklist')} /></th>
                  <th><UiText text={t('Signatures')} /></th><th><UiText text={t('Accountable')} /></th><th><UiText text={t('Blocked by')} /></th>
                  <th><UiText text={t('Can pass?')} /></th><th></th></tr>
            </thead>
            <tbody>
              {gates.map((g) => (
                <tr key={g.gateId}>
                  <td>
                    <a href={`/governance/${g.projectId}`}><strong>{g.projectCode}</strong></a>
                    <div className="dim">{g.projectName}</div>
                  </td>
                  <td><UiText text={"SG"} />{g.seq} <UiText text={t(g.name)} /></td>
                  <td className="num">
                    {g.criteriaTotal === 0
                      ? <span className="dim"><UiText text={t('no checklist')} /></span>
                      : <><span className={g.criteriaMet === g.criteriaTotal ? 'good' : 'warnt'}>
                          {g.criteriaMet}/{g.criteriaTotal}</span>
                          <div className="bar"><i style={{ width: `${(g.criteriaMet / g.criteriaTotal) * 100}%` }} /></div></>}
                  </td>
                  <td className="num">{g.unsigned === 0
                    ? <span className="good"><UiText text={t('all signed')} /></span>
                    : <span className="warnt">{g.unsigned} <UiText text={t('pending')} /></span>}</td>
                  <td>{g.accountable ?? <span className="dim"><UiText text={t('unassigned')} /></span>}</td>
                  <td>{g.blockedBy.length === 0
                    ? <span className="dim">—</span>
                    : g.blockedBy.map((b) => <div key={b} className="crit">{b}</div>)}</td>
                  <td>{g.mayPass
                    ? <span className="pill on_track"><UiText text={t('yes')} /></span>
                    : <span className="pill critical"><UiText text={t('no')} /></span>}</td>
                  <td><a className="btn ghost" href={`/governance/${g.projectId}`}><UiText text={t('Open')} /></a></td>
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
