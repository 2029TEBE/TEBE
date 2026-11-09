import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { BarChart } from '@/components/Chart';
import { money, num } from '@/lib/fmt';
import { tr } from '@/lib/i18n';
import { financialIntelligence } from '@/lib/financial-intelligence';

/** Additive view: does not change /financials, original EV/CPI services, or project cost writes. */
export default async function FinancialIntelligencePage() {
  const t=await tr();
  return <Page title="Financial Intelligence"
    sub="Forecast exceptions, data-quality signals, and earned-value estimates by project.">
    <Loaded load={api.financials}>
      {(data:any)=>{
        const insight=financialIntelligence(data?.byProject);
        const comparable=insight.projects.filter(p=>p.variancePct!==null).slice(0,10);
        return <section aria-label="Financial intelligence" style={{display:'grid',gap:'20px'}}>
          <div className="tiles">
            <div className="tile"><span>{t('Projects analyzed')}</span><strong>{insight.projects.length}</strong></div>
            <div className="tile"><span>{t('Forecast above budget')}</span><strong className={insight.overrunProjects?'crit':'good'}>{insight.overrunProjects}</strong></div>
            <div className="tile"><span>{t('Estimates needing review')}</span><strong>{insight.unreliableForecasts}</strong></div>
          </div>
          <div className="chartcard">
            <h2 className="sec">{t('Forecast variance as % of each project's budget')}</h2>
            {comparable.length?<BarChart caption="Forecast variance percentage by project" labels={comparable.map(p=>p.code)}
              values={comparable.map(p=>Math.max(0,p.variancePct??0))} format={v=>`${Math.round(v)}%`}
              hrefs={comparable.map(()=>'/financials')}/>:
              <p className="dim">{t('No projects with an approved budget available.')}</p>}
          </div>
          <div className="panel">
            <h2 className="sec">{t('Project-level financial signals')}</h2>
            <p className="dim">{t('Keep figures in each project’s recorded currency. Do not combine different currencies without verified conversion.')}</p>
            <div className="scrollx"><table>
              <thead><tr>
                <th>{t('Project')}</th><th>{t('Budget')}</th><th>{t('Forecast')}</th><th>{t('Variance')}</th><th>{t('Variance %')}</th>
                <th>{t('CPI')}</th><th>{t('EAC')}</th><th>{t('Forecast coverage')}</th>
              </tr></thead>
              <tbody>{insight.projects.map(p=><tr key={p.code}>
                <td><strong>{p.code}</strong><div className="dim">{t(p.note)}</div></td>
                <td className="num">{money(p.budget)}</td><td className="num">{money(p.forecast)}</td>
                <td className={p.forecastVariance>0?'num crit':'num'}>{money(p.forecastVariance)}</td>
                <td className={p.forecastVariance>0?'num crit':'num'}>{p.variancePct===null?'—':`${num(p.variancePct,1)}%`}</td>
                <td className="num">{p.cpi===null?'—':num(p.cpi,2)}</td>
                <td className="num">{money(p.eac)}</td>
                <td className="num">{Math.round(p.forecastCoverage*100)}%</td>
              </tr>)}</tbody>
            </table></div>
            <p className="dim">{t(insight.disclaimer)}</p>
            <p><a href="/financials">{t('Financials')}</a> · <a href="/analytics">{t('Portfolio Analytics')}</a></p>
          </div>
        </section>;
      }}
    </Loaded>
  </Page>;
}
