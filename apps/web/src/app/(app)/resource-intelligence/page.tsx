import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { BarChart } from '@/components/Chart';
import { resourceCapacity } from '@/lib/resource-capacity';
import { tr } from '@/lib/i18n';

/** Optional resource analytics view; existing /resources create and allocation workflows stay intact. */
export default async function ResourceIntelligencePage() {
  const t=await tr();
  return (
    <Page title="Resource Capacity Intelligence" sub="Understand concentration and overcommitment across the current workspace.">
      <Loaded load={api.resources}>
        {(data:any)=>{
          const summary=resourceCapacity(data?.people);
          return <section aria-label="Resource capacity intelligence" style={{display:'grid',gap:'20px'}}>
            <div className="tiles">
              <div className="tile"><span>{t('People with allocation records')}</span><strong>{summary.people}</strong></div>
              <div className="tile"><span>{t('Overallocated')}</span><strong className={summary.overallocated?'crit':'good'}>{summary.overallocated}</strong></div>
              <div className="tile"><span>{t('Near capacity')}</span><strong>{summary.nearCapacity}</strong></div>
              <div className="tile"><span>{t('Average recorded allocation')}</span><strong>{summary.averageAllocatedPct===null?'—':`${summary.averageAllocatedPct}%`}</strong></div>
            </div>
            <div className="chartcard">
              <h2 className="sec">{t('Allocation distribution')}</h2>
              {summary.people===0?<p className="dim">{t('No allocation records available.')}</p>:
                <BarChart caption="Resource allocation distribution" labels={summary.bands.map(b=>b.label)}
                  values={summary.bands.map(b=>b.value)} format={n=>String(Math.round(n))}
                  hrefs={summary.bands.map(()=>'/resources')} />}
            </div>
            <div className="panel">
              <h2 className="sec">{t('Capacity interpretation')}</h2>
              <p><strong>{summary.extraAllocationPoints}</strong> {t('total allocation percentage points above 100% across overcommitted people.')}</p>
              <p className="dim">{t(summary.note)}</p>
              <p className="dim">{t('This view is descriptive and read-only. It neither reallocates people nor calculates future demand.')}</p>
              <p><a href="/resources">{t('Manage allocations')}</a> · <a href="/analytics">{t('Portfolio Analytics')}</a></p>
            </div>
          </section>;
        }}
      </Loaded>
    </Page>
  );
}
