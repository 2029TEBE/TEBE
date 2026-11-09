import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceCapacity} from './resource-capacity.ts';
test('empty workspace does not invent capacity',()=>{
 const r=resourceCapacity([]);assert.equal(r.people,0);assert.equal(r.averageAllocatedPct,null);
});
test('categorizes overload, near-capacity and unallocated resources',()=>{
 const r=resourceCapacity([{allocatedPct:135},{allocatedPct:100},{allocatedPct:90},{allocatedPct:35},{allocatedPct:0}]);
 assert.equal(r.people,5);assert.equal(r.overallocated,1);assert.equal(r.nearCapacity,2);
 assert.equal(r.belowCapacity,1);assert.equal(r.unallocated,1);assert.equal(r.extraAllocationPoints,35);
});
test('never returns identifying or financial input',()=>{
 const r=resourceCapacity([{allocatedPct:130,name:'Private User',email:'private@example.test',salary:999999}]);
 assert.equal(r.overallocated,1);assert.doesNotMatch(JSON.stringify(r),/Private User|private@example|999999/);
});
test('excludes malformed percentage records and avoids false predictions',()=>{
 const r=resourceCapacity([{allocatedPct:Infinity},{allocatedPct:-1},{allocatedPct:'100'},{allocatedPct:25}]);
 assert.equal(r.people,1);assert.match(r.note,/not a dated capacity forecast/);
});
