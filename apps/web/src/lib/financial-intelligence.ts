/** Explain existing, tenant-authorized financial estimates without altering them.
 * Source: /api/v1/financials. Each project is kept separate because rows may
 * use different currencies; no cross-currency portfolio totals are fabricated.
 * Progress-derived earned value is not a certified performance baseline.
 */
export type FinancialSignal = {
  code: string; budget: number; actual: number; forecast: number; earnedValue: number;
  cpi: number|null; eac: number|null; forecastCoverage: number;
  forecastVariance: number; estimatedOverrun: number|null;
  state: 'overrun'|'within-budget'|'insufficient-data';
  note: string;
};
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
export function financialIntelligence(input:unknown):{
  projects:FinancialSignal[]; overrunProjects:number; unreliableForecasts:number;
  disclaimer:string;
} {
  const data=Array.isArray(input)?input:[];
  const projects:FinancialSignal[]=[];
  for(const v of data) {
    if(!v||typeof v!=='object') continue;
    const x=v as Record<string,unknown>;
    if(typeof x.code!=='string'||!x.code.trim()||!['budget','actual','forecast','earnedValue'].every(k=>finite(x[k])&&(x[k] as number)>=0)) continue;
    const budget=x.budget as number, actual=x.actual as number, forecast=x.forecast as number, earnedValue=x.earnedValue as number;
    const forecastCoverage=finite(x.forecastCoverage)?Math.max(0,Math.min(1,x.forecastCoverage)):0;
    // Reuse the service's materiality threshold; don't fabricate a ratio when spend is immature.
    const drawn=budget>0?actual/budget:0;
    const cpi=drawn>=0.15&&actual>0&&finite(x.cpi)&&x.cpi>=0?x.cpi:null;
    const eac=cpi!==null&&cpi>0&&finite(x.eac)&&x.eac>=0?x.eac:null;
    const forecastVariance=forecast-budget;
    const state:FinancialSignal['state']=budget===0?'insufficient-data':forecastVariance>0?'overrun':'within-budget';
    const note=budget===0?'No approved budget recorded.'
      :forecastCoverage<1?'Forecast is partly substituted with budget where category forecasts are missing.'
      :cpi===null?'CPI/EAC unavailable or immature; no extrapolation shown.'
      :'CPI and EAC are estimates based on reported progress, not a certified baseline.';
    projects.push({code:x.code,budget,actual,forecast,earnedValue,cpi,eac,forecastCoverage,forecastVariance,
      estimatedOverrun:eac===null?null:eac-budget,state,note});
  }
  return {projects:projects.sort((a,b)=>b.forecastVariance-a.forecastVariance),
    overrunProjects:projects.filter(p=>p.state==='overrun').length,
    unreliableForecasts:projects.filter(p=>p.forecastCoverage<1||p.cpi===null).length,
    disclaimer:'Read-only estimates from current authorized project records. Currency normalization and independent schedule baselines are not verified; avoid cross-currency sums and SPI claims.'};
}
