import test from 'node:test';
import assert from 'node:assert/strict';
import {validateApprovedStripeCatalogue} from './stripe-approved-catalogue.mjs';
const valid={
 schemaVersion:1,approvedBy:'Business owner',approvedAt:'2026-11-16T00:00:00.000Z',
 taxPolicy:{collection:'manual',behavior:'exclusive',countryApproved:true},
 items:[{code:'illustrative_only',name:'Synthetic example only',currency:'usd',
 unitAmountMinor:1200,interval:'month'}],
};
test('strict approved manifest returns no-write output only',()=>{
 const p=validateApprovedStripeCatalogue(valid);
 assert.equal(p.sandboxOnly,true);
 assert.equal(p.stripeApiCalls,0);
 assert.equal(p.databaseWrites,0);
 assert.equal(p.paymentCharges,0);
 assert.equal(p.items.length,1);
});
test('missing or unapproved prices and tax choices fail closed',()=>{
 for(const bad of [
  {...valid,approvedBy:''},
  {...valid,taxPolicy:{...valid.taxPolicy,countryApproved:false}},
  {...valid,taxPolicy:{...valid.taxPolicy,behavior:'unknown'}},
  {...valid,items:[]},
  {...valid,items:[{...valid.items[0],unitAmountMinor:0}]},
  {...valid,items:[{...valid.items[0],unitAmountMinor:12.5}]},
  {...valid,items:[{...valid.items[0],stripePriceId:'fake'}]},
  {...valid,items:[...valid.items,...valid.items]},
  {...valid,items:[{...valid.items[0],notes:'undocumented'}]},
 ])assert.throws(()=>validateApprovedStripeCatalogue(bad));
});
test('no mutation methods or network code appear in approved catalogue module',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('./stripe-approved-catalogue.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bfetch\(|\bhttps\.request|INSERT INTO|UPDATE billing_|stripe_api_write/);
});
