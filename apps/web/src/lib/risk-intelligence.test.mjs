import test from 'node:test';
import assert from 'node:assert/strict';
import {riskIntelligence} from './risk-intelligence.ts';

test('empty results do not invent a risk forecast',()=>{
 const r=riskIntelligence([]); assert.equal(r.total,0); assert.equal(r.weightedScore,null); assert.equal(r.hotSpots.length,0);
});
test('bands, score, sorting are derived solely from counts',()=>{
 const r=riskIntelligence([{severity:5,likelihood:5,n:2},{severity:3,likelihood:3,n:4},{severity:1,likelihood:1,n:1}]);
 assert.equal(r.total,7);assert.equal(r.critical,2);assert.equal(r.medium,4);assert.equal(r.low,1);assert.equal(r.hotSpots[0].score,25);
});
test('malformed rows and incidental private fields are not forwarded',()=>{
 const r=riskIntelligence([{severity:5,likelihood:4,n:1,customerEmail:'do-not-expose@example.com'},{severity:6,likelihood:5,n:2},{severity:4,likelihood:4,n:-1}]);
 assert.equal(r.total,1);assert.doesNotMatch(JSON.stringify(r),/do-not-expose/);
});
test('duplicate severity-likelihood coordinates merge safely',()=>{
 const r=riskIntelligence([{severity:5,likelihood:3,n:1},{severity:5,likelihood:3,n:2}]);
 assert.equal(r.total,3);assert.equal(r.hotSpots.length,1);
});
