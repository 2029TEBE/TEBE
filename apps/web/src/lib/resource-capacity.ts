/** Descriptive capacity indicators from the existing authenticated workspace resource aggregate.
 * Allocations have no effective-date filtering in the current API. These numbers
 * describe recorded allocations, NOT confirmed availability on a future date.
 * No employee names, IDs or allocation rows are returned by this helper.
 */
export type CapacitySummary = {
  people: number; overallocated: number; nearCapacity: number; belowCapacity: number;
  unallocated: number; extraAllocationPoints: number; averageAllocatedPct: number|null;
  bands: {label: string; value: number}[];
  note: string;
};
export function resourceCapacity(input: unknown): CapacitySummary {
  const raw = Array.isArray(input) ? input : [];
  const valid = raw.filter((r):r is {allocatedPct:number} =>
    !!r && typeof r==='object' && typeof r.allocatedPct==='number'
    && Number.isFinite(r.allocatedPct) && r.allocatedPct>=0 && r.allocatedPct<=100000);
  const people=valid.length;
  const overallocated=valid.filter(p=>p.allocatedPct>100).length;
  const nearCapacity=valid.filter(p=>p.allocatedPct>=90&&p.allocatedPct<=100).length;
  const belowCapacity=valid.filter(p=>p.allocatedPct>0&&p.allocatedPct<90).length;
  const unallocated=valid.filter(p=>p.allocatedPct===0).length;
  const extraAllocationPoints=valid.reduce((sum,p)=>sum+Math.max(0,p.allocatedPct-100),0);
  const averageAllocatedPct=people?Math.round(valid.reduce((sum,p)=>sum+p.allocatedPct,0)/people*10)/10:null;
  return {people,overallocated,nearCapacity,belowCapacity,unallocated,
    extraAllocationPoints,averageAllocatedPct,
    bands:[
      {label:'Over 100%',value:overallocated},
      {label:'90–100%',value:nearCapacity},
      {label:'1–89%',value:belowCapacity},
      {label:'0%',value:unallocated},
    ],
    note:'Recorded allocation percentages, not a dated capacity forecast. Existing API does not filter allocations by effective dates; do not infer upcoming availability.'};
}
