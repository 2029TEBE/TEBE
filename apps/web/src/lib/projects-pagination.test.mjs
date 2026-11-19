import test from 'node:test';
import assert from 'node:assert/strict';
import {validProjectCursor,validProjectHealth,projectPageHref} from './projects-pagination.ts';
const cursor='2026-11-18T16:20:43.000Z';
const program='11111111-1111-4111-8111-111111111111';
test('API project cursor requires an exact timestamp and rejects ambiguous input',()=>{
 assert.equal(validProjectCursor(cursor),cursor);
 for(const x of ['bad','2026-11-18','2026-02-30T00:00:00.000Z',null,[],{},'x'.repeat(70)])
  assert.equal(validProjectCursor(x),undefined);
});
test('health filter is strict and invalid input never blanks project rows',()=>{
 for(const x of ['on_track','at_risk','critical'])
  assert.equal(validProjectHealth(x),x);
 for(const x of ['Critical','unknown','critical%20','',null,[],{},'on-track'])
  assert.equal(validProjectHealth(x),undefined);
});
test('next page retains programme and backend health filter, never an external redirect',()=>{
 const url=new URL(projectPageHref(cursor,program,'critical'),'https://theepmo.com');
 assert.equal(url.pathname,'/projects');
 assert.equal(url.searchParams.get('cursor'),cursor);
 assert.equal(url.searchParams.get('program'),program);
 assert.equal(url.searchParams.get('health'),'critical');
 assert.equal(projectPageHref(null),'/projects');
 assert.equal(projectPageHref(null,program),'/projects?program='+program);
});
test('clearing health retains programme but discards the old cursor',()=>{
 const url=new URL(projectPageHref(null,program),'https://theepmo.com');
 assert.equal(url.searchParams.get('program'),program);
 assert.equal(url.searchParams.has('cursor'),false);
 assert.equal(url.searchParams.has('health'),false);
});
