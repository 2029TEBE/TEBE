import test from 'node:test';
import assert from 'node:assert/strict';
import {financialIntelligence} from './financial-intelligence.ts';

const row=(values={})=>({code:'P-001',budget:1000,actual:500,forecast:1150,earnedValue:400,cpi:0.8,eac:1250,forecastCoverage:1,...values});
test('empty input never invents estimates',()=>{
 const r=financialIntelligence([]);assert.equal(r.projects.length,0);assert.equal(r.overrunProjects,0);
});
test('preserves backend CPI and EAC without recomputing misleading baselines',()=>{
 const p=financialIntelligence([row()]).projects[0];
 assert.equal(p.forecastVariance,150);assert.equal(p.variancePct,15);assert.equal(p.estimatedOverrun,250);assert.equal(p.cpi,0.8);
});
test('immature spend hides CPI and EAC rather than forecasting',()=>{
 const p=financialIntelligence([row({actual:50,cpi:7,eac:142})]).projects[0];
 assert.equal(p.cpi,null);assert.equal(p.eac,null);assert.equal(p.estimatedOverrun,null);
});
test('missing forecast coverage is highlighted, budget-free projects are not overrun',()=>{
 const r=financialIntelligence([row({forecastCoverage:0.25}),row({code:'P-002',budget:0,actual:0,forecast:300,earnedValue:0,cpi:null,eac:null})]);
 assert.equal(r.unreliableForecasts,2);assert.equal(r.projects.find(p=>p.code==='P-002').state,'insufficient-data');
});
test('untrusted incidental data is not included and invalid numbers are rejected',()=>{
 const r=financialIntelligence([row({customerEmail:'private@example.test'}),row({code:'BAD',budget:Infinity})]);
 assert.equal(r.projects.length,1);assert.doesNotMatch(JSON.stringify(r),/private@example|BAD/);
});

test('percentage ranking is currency-neutral and excludes unbudgeted projects',()=>{
 const r=financialIntelligence([row({code:'SMALL',budget:100,forecast:130}),row({code:'LARGE',budget:100000,forecast:110000})]);
 assert.deepEqual(r.projects.map(p=>p.code),['SMALL','LARGE']);
});
