import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { money, pct } from '@/lib/fmt';
import { tr, term, getLang } from '@/lib/i18n';
import { TrendPanel, HealthDonut, type TrendPoint } from '@/components/SimCharts';
import { attentionReasons, attentionLink } from '@/lib/executive-attention';

/** Geometry only: text and underlying API metrics retain their real values. */
const boundedBarFill = (pct: number) =>
  Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;

export default async function Home() {
  const lang = await getLang();
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
                  <span>{t('Projects')}</span>
                  <strong>{d.health.total}</strong>
                  <div className="split">
                    <i className="good">{d.health.on_track} {t('on track')}</i>
                    <i className="warnt">{d.health.at_risk} {t('at risk')}</i>
                    <i className="crit">{d.health.critical} {t('critical')}</i>
                  </div>
                </div>
                <div className="tile">
                  <span>{t('Average progress')}</span>
                  <strong>{pct(d.health.avg_progress)}</strong>
                  <div className="bar"><i aria-hidden="true" style={{ width: `${boundedBarFill(d.health.avg_progress)}%` }} /></div>
                </div>
                <div className={`tile${d.gates.blocked > 0 ? ' alarm' : ''}`}>
                  <span>{t('Gates blocked')}</span>
                  <strong>{d.gates.blocked}<em>/{d.gates.active} {t('active')}</em></strong>
                  <div className="split"><i className="dim">{t('a blocked gate holds funding')}</i></div>
                </div>
                {d.money && <div className="tile">
                  <span>{t('Budget drawn')}</span>
                  <strong>{pct(spend)}</strong>
                  <div className="bar"><i aria-hidden="true" style={{ width: `${boundedBarFill(spend)}%` }} /></div>
                  <div className="split"><i className="dim">{money(d.money.actual)} {t('of')} {money(d.money.budget)} {t('SAR')}</i></div>
                </div>}
                <div className={`tile${d.register.critical > 0 ? ' alarm' : ''}`}>
                  <span>{t('Open register items')}</span>
                  <strong>{d.register.open}</strong>
                  <div className="split">
                    <i className="crit">{d.register.critical} {t('critical')}</i>
                    <i className="warnt">{d.register.overdue} {t('overdue')}</i>
                  </div>
                </div>
                <div className="tile">
                  <span>{t('Benefits on track')}</span>
                  <strong>{pct(d.benefits.avg_pct)}</strong>
                  <div className="split"><i className="dim">{d.benefits.realized} {t('of')} {d.benefits.total} {t('realized')}</i></div>
                </div>
              </div>

              <section className="design-journey" aria-label={t('Executive decision journey')}>
                <div className="design-journey-intro">
                  <span className="design-kicker">{t('FROM SIGNALS TO DECISIONS')}</span>
                  <h2>{t('Turn delivery signals into accountable reviews')}</h2>
                  <p>{t('These are the current workspace API signals, not automated decisions or approvals.')}</p>
                </div>
                <div className="design-journey-steps">
                  <div className="design-journey-step">
                    <span className="design-step-index">01</span>
                    <small>{t('OBSERVE')}</small>
                    <strong>{d.register.overdue}</strong>
                    <span>{t('Overdue register items')}</span>
                  </div>
                  <div className="design-journey-step">
                    <span className="design-step-index">02</span>
                    <small>{t('VERIFY')}</small>
                    <strong>{d.gates.blocked}</strong>
                    <span>{t('Blocked gates needing evidence review')}</span>
                  </div>
                  <div className="design-journey-step">
                    <span className="design-step-index">03</span>
                    <small>{t('HUMAN DECISION')}</small>
                    <strong>{d.attention.length}</strong>
                    <span>{t('Projects returned in the attention queue')}</span>
                  </div>
                </div>
                <div className="design-journey-footer">
                  <span>{t('Check the source evidence and accountable owner before acting.')}</span>
                  <a href="/decision-cockpit" className="btn ghost">{t('Open decision cockpit')}</a>
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

              <h2 className="sec">{t('Needs attention')} <a className="btn ghost" href="/decision-cockpit">{t('Open decision cockpit')}</a></h2>
              {d.attention.length === 0
                ? <p className="quietempty">{t('Nothing is off track. Unusual — check the data is current.')}</p>
                : (
                  <>
                    <p className="dim">{t('Priority queue includes gate blockers, critical risks and overdue items.')}</p>
                    <div className="design-table-scroll" role="region" aria-label={t('Needs attention')} tabIndex={0}><table>
                      <thead><tr><th>{t('Project')}</th><th>{t('Health')}</th><th>{t('Current gate')}</th><th>{t('Why')}</th><th>{t('Action')}</th></tr></thead>
                      <tbody>
                        {d.attention.map((a: any) => (
                          <tr key={a.projectId}>
                            <td><strong>{a.code}</strong><div className="dim">{a.name}</div></td>
                            <td><span className={`pill ${a.health}`}>{term(t, a.health)}</span></td>
                            <td>{a.gateSeq === null
                              ? <span className="dim">{t('No active gate')}</span>
                              : `SG${a.gateSeq} ${t(a.gateName ?? '')}`}</td>
                            <td>{attentionReasons(a).map((reason, i) => (
                              <span key={`${reason.key}-${i}`} className={reason.key === 'health flag, no blocker recorded' ? 'dim' : 'crit'}>
                                {i > 0 ? ' · ' : ''}{reason.count !== undefined ? `${reason.count.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')} ` : ''}{t(reason.key)}
                              </span>
                            ))}</td>
                            <td><a className="btn ghost" href={attentionLink(a)}>{t('Review')}</a></td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                    {d.attention[0]?.totalAttention > d.attention.length && (
                      <p className="dim">{lang === 'ar'
                        ? `عرض أول ${d.attention.length.toLocaleString('ar-SA')} من أصل ${d.attention[0].totalAttention.toLocaleString('ar-SA')} مشروعًا يحتاج إلى مراجعة.`
                        : `Showing the first ${d.attention.length} of ${d.attention[0].totalAttention} projects needing review.`}</p>
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
