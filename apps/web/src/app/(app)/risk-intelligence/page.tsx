import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { BarChart } from '@/components/Chart';
import { tr } from '@/lib/i18n';
import { riskIntelligence } from '@/lib/risk-intelligence';

/** Optional additive decision-support view; existing analytics and governance remain unchanged.
 * Reads only the authenticated, tenant-scoped analytics endpoint.
 */
export default async function RiskIntelligencePage() {
  const t=await tr();
  return (
    <Page title="Risk Intelligence" sub="Explainable risk concentration and priority signals from the current open register.">
      <Loaded load={api.analytics}>
        {(data:any)=>{
          const risk=riskIntelligence(data?.riskHeat);
          const bands=[
            {key:'critical',label:t('Critical'),value:risk.critical},
            {key:'high',label:t('High'),value:risk.high},
            {key:'medium',label:t('Medium'),value:risk.medium},
            {key:'low',label:t('Low'),value:risk.low},
          ];
          return <section aria-label="Risk intelligence" style={{display:'grid',gap:'20px'}}>
            <div className="tiles">
              <div className="tile"><span>{t('Scored open items')}</span><strong>{risk.total}</strong></div>
              <div className="tile"><span>{t('Critical exposure')}</span><strong className={risk.critical?'crit':'good'}>{risk.critical}</strong></div>
              <div className="tile"><span>{t('High exposure')}</span><strong>{risk.high}</strong></div>
              <div className="tile"><span>{t('Average risk score')}</span><strong>{risk.weightedScore??'—'}</strong><span className="dim">{t('Ordinal scale: 1–25')}</span></div>
            </div>
            <div className="chartcard">
              <h2 className="sec">{t('Open items by exposure band')}</h2>
              <BarChart labels={bands.map(b=>b.label)} values={bands.map(b=>b.value)} format={v=>String(Math.round(v))} caption="Risk exposure bands" hrefs={bands.map(()=>'/raid')} />
            </div>
            <div className="panel">
              <h2 className="sec">{t('Priority concentrations')}</h2>
              {risk.hotSpots.length ? <div className="scrollx"><table>
                <thead><tr><th>{t('Impact')}</th><th>{t('Likelihood')}</th><th>{t('Score')}</th><th>{t('Open items')}</th></tr></thead>
                <tbody>{risk.hotSpots.map(c=><tr key={`${c.severity}-${c.likelihood}`}>
                  <td>{c.severity}/5</td><td>{c.likelihood}/5</td><td className={c.band==='critical'?'crit':''}>{c.score}/25</td>
                  <td><a href="/raid">{c.count}</a></td>
                </tr>)}</tbody>
              </table></div>:<p className="dim">{t('No scored open risk items available.')}</p>}
              <p className="dim">{t(risk.message)}</p>
              <p className="dim">{t('This is a read-only view of current workspace data. It does not change risk scores, create approvals, or predict financial losses.')}</p>
              <p><a href="/analytics">{t('Portfolio Analytics')}</a> · <a href="/raid">{t('Open risk register')}</a></p>
            </div>
          </section>;
        }}
      </Loaded>
    </Page>
  );
}
