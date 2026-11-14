import { UiText } from '@/components/UiLocale';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { money, pct } from '@/lib/fmt';
import { tr, term, getFrontendLocale } from '@/lib/i18n';
import { fill } from '@pmo/contracts';
import { TrendPanel, HealthDonut, type TrendPoint } from '@/components/SimCharts';
import { attentionReasons, attentionLink } from '@/lib/executive-attention';

/** Geometry only: text and underlying API metrics retain their real values. */
const boundedBarFill = (pct: number) =>
  Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;

export default async function Home() {
  const locale = await getFrontendLocale();
  const t = await tr();
  return (
    <Page title="Executive Overview"
          sub="Are we delivering the strategy? What needs attention now, and where is a decision required?">
      <Loaded load={async () => ({
        d: await api.overview(),
        /*
         * The curve comes from Analytics360, which not every workspace has
         * licensed. A missing licence is a normal state, not a failure, so it
         * degrades to an empty series and the panel says why rather than the
         * whole page refusing to render.
         */
        trend: await api.trends().catch(() => null),
      })}>
        {({ d, trend }) => {
          const spend = d.money?.budget ? (d.money.actual / d.money.budget) * 100 : 0;
          return (
            <>
              <div className="tiles">
                <div className="tile">
                  <span><UiText text={t('Projects')} /></span>
                  <strong>{d.health.total}</strong>
                  <div className="split">
                    <i className="good">{d.health.on_track} <UiText text={t('on track')} /></i>
                    <i className="warnt">{d.health.at_risk} <UiText text={t('at risk')} /></i>
                    <i className="crit">{d.health.critical} <UiText text={t('critical')} /></i>
                  </div>
                </div>
                <div className="tile">
                  <span><UiText text={t('Average progress')} /></span>
                  <strong>{pct(d.health.avg_progress)}</strong>
                  <div className="bar"><i aria-hidden="true" style={{ width: `${boundedBarFill(d.health.avg_progress)}%` }} /></div>
                </div>
                <div className={`tile${d.gates.blocked > 0 ? ' alarm' : ''}`}>
                  <span><UiText text={t('Gates blocked')} /></span>
                  <strong>{d.gates.blocked}<em>/{d.gates.active} <UiText text={t('active')} /></em></strong>
                  <div className="split"><i className="dim"><UiText text={t('a blocked gate holds funding')} /></i></div>
                </div>
                {d.money && <div className="tile">
                  <span><UiText text={t('Budget drawn')} /></span>
                  <strong>{pct(spend)}</strong>
                  <div className="bar"><i aria-hidden="true" style={{ width: `${boundedBarFill(spend)}%` }} /></div>
                  <div className="split"><i className="dim">{money(d.money.actual)} <UiText text={t('of')} /> {money(d.money.budget)} <UiText text={t('SAR')} /></i></div>
                </div>}
                <div className={`tile${d.register.critical > 0 ? ' alarm' : ''}`}>
                  <span><UiText text={t('Open register items')} /></span>
                  <strong>{d.register.open}</strong>
                  <div className="split">
                    <i className="crit">{d.register.critical} <UiText text={t('critical')} /></i>
                    <i className="warnt">{d.register.overdue} <UiText text={t('overdue')} /></i>
                  </div>
                </div>
                <div className="tile">
                  <span><UiText text={t('Benefits on track')} /></span>
                  <strong>{pct(d.benefits.avg_pct)}</strong>
                  <div className="split"><i className="dim">{d.benefits.realized} <UiText text={t('of')} /> {d.benefits.total} <UiText text={t('realized')} /></i></div>
                </div>
              </div>

              <section className="design-journey" aria-label={t('Executive decision journey')}>
                <div className="design-journey-intro">
                  <span className="design-kicker"><UiText text={t('FROM SIGNALS TO DECISIONS')} /></span>
                  <h2><UiText text={t('Turn delivery signals into accountable reviews')} /></h2>
                  <p><UiText text={t('These are the current workspace API signals, not automated decisions or approvals.')} /></p>
                </div>
                <div className="design-journey-steps">
                  <div className="design-journey-step">
                    <span className="design-step-index">01</span>
                    <small><UiText text={t('OBSERVE')} /></small>
                    <strong>{d.register.overdue}</strong>
                    <span><UiText text={t('Overdue register items')} /></span>
                  </div>
                  <div className="design-journey-step">
                    <span className="design-step-index">02</span>
                    <small><UiText text={t('VERIFY')} /></small>
                    <strong>{d.gates.blocked}</strong>
                    <span><UiText text={t('Blocked gates needing evidence review')} /></span>
                  </div>
                  <div className="design-journey-step">
                    <span className="design-step-index">03</span>
                    <small><UiText text={t('HUMAN DECISION')} /></small>
                    <strong>{d.attention.length}</strong>
                    <span><UiText text={t('Projects returned in the attention queue')} /></span>
                  </div>
                </div>
                <div className="design-journey-footer">
                  <span><UiText text={t('Check the source evidence and accountable owner before acting.')} /></span>
                  <a href="/decision-cockpit" className="btn ghost"><UiText text={t('Open decision cockpit')} /></a>
                </div>
              </section>

              <div className="simgrid2">
                <TrendPanel t={t} eyebrow={t('Delivery trend')} title={t('Portfolio performance')}
                  note={trend?.historyNote?.enough ? undefined : t('Cumulative, by month')}
                  /* The cumulative fields, not the per-month ones. `actual`
                     is a single month's spend, so plotting it drew a bell
                     curve falling back to zero and calling it cumulative. */
                  points={(trend?.sCurve ?? []).map((p: any): TrendPoint => ({
                    period: p.period,
                    planned: Number(p.cumBudget ?? 0), actual: Number(p.cumActual ?? 0),
                  }))} />
                <HealthDonut t={t} eyebrow={t('Portfolio mix')} title={t('Project health')}
                  onTrack={d.health.on_track} atRisk={d.health.at_risk} critical={d.health.critical} />
              </div>

              <h2 className="sec"><UiText text={t('Needs attention')} /> <a className="btn ghost" href="/decision-cockpit"><UiText text={t('Open decision cockpit')} /></a></h2>
              {d.attention.length === 0
                ? <p className="quietempty"><UiText text={t('Nothing is off track. Unusual — check the data is current.')} /></p>
                : (
                  <>
                    <p className="dim"><UiText text={t('Priority queue includes gate blockers, critical risks and overdue items.')} /></p>
                    <div className="design-table-scroll" role="region" aria-label={t('Needs attention')} tabIndex={0}><table>
                      <thead><tr><th><UiText text={t('Project')} /></th><th><UiText text={t('Health')} /></th><th><UiText text={t('Current gate')} /></th><th><UiText text={t('Why')} /></th><th><UiText text={t('Action')} /></th></tr></thead>
                      <tbody>
                        {d.attention.map((a: any) => (
                          <tr key={a.projectId}>
                            <td><strong>{a.code}</strong><div className="dim">{a.name}</div></td>
                            <td><span className={`pill ${a.health}`}>{term(t, a.health)}</span></td>
                            <td>{a.gateSeq === null
                              ? <span className="dim"><UiText text={t('No active gate')} /></span>
                              : `SG${a.gateSeq} ${t(a.gateName ?? '')}`}</td>
                            <td>{attentionReasons(a).map((reason, i) => (
                              <span key={`${reason.key}-${i}`} className={reason.key === 'health flag, no blocker recorded' ? 'dim' : 'crit'}>
                                <UiText text={i > 0 ? ' · ' : ''} />{reason.count !== undefined ? `${reason.count.toLocaleString(locale)} ` : ''}<UiText text={t(reason.key)} />
                              </span>
                            ))}</td>
                            <td><a className="btn ghost" href={attentionLink(a)}><UiText text={t('Review')} /></a></td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                    {d.attention[0]?.totalAttention > d.attention.length && (
                      <p className="dim">{fill(t('Showing the first {shown} of {total} projects needing review.'), {
                        shown: d.attention.length.toLocaleString(locale),
                        total: d.attention[0].totalAttention.toLocaleString(locale),
                      })}</p>
                    )}
                  </>
                )}
            </>
          );
        }}
      </Loaded>
    </Page>
  );
}
