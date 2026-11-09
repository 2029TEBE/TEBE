/** Tenant-scoped, descriptive analysis of the existing risk-heat aggregate.
 * Never assign probabilities to ordinal 1–5 likelihood scores.
 * No customer information, projected loss, or invented forecast is produced.
 */
export type RiskCell = { severity: number; likelihood: number; count: number; score: number; band: 'critical'|'high'|'medium'|'low' };
export type RiskSummary = { total: number; critical: number; high: number; medium: number; low: number; hotSpots: RiskCell[]; weightedScore: number|null; message: string };
export function riskIntelligence(input: unknown): RiskSummary {
  const tally = new Map<string, number>();
  if (Array.isArray(input)) for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const s=Number(row.severity), l=Number(row.likelihood), n=Number(row.n);
    if (![s,l,n].every(Number.isSafeInteger) || s<1 || s>5 || l<1 || l>5 || n<0) continue;
    const key=`${s}-${l}`;
    tally.set(key,(tally.get(key) ?? 0)+n);
  }
  const cells:RiskCell[] = [...tally.entries()].map(([key,count])=>{
    const [severity,likelihood]=key.split('-').map(Number), score=severity*likelihood;
    const band: RiskCell['band']=score>=15?'critical':score>=10?'high':score>=5?'medium':'low';
    return {severity,likelihood,count,score,band};
  });
  const total=cells.reduce((a,c)=>a+c.count,0);
  const counts={critical:0,high:0,medium:0,low:0};
  for(const c of cells) counts[c.band]+=c.count;
  const hotSpots=cells.filter(c=>c.count>0).sort((a,b)=>b.score-a.score||b.count-a.count||b.severity-a.severity).slice(0,5);
  return {total,...counts,hotSpots,weightedScore:total?Number((cells.reduce((a,c)=>a+c.score*c.count,0)/total).toFixed(2)):null,
    message:total?'Descriptive exposure across open register items; scores are ordinal, not monetary losses or probabilities.':'No scored open risk items available. No exposure forecast can be inferred.'};
}
