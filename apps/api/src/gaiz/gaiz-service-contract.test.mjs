import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGaizToolRequest,parseGaizJobResponse,requireGaizServicePrincipal} from './gaiz-service-contract.mjs';
test('draft contract validates bounded synthetic report requests',()=>{
 assert.equal(parseGaizToolRequest({toolId:'demo',format:'pdf',inputs:{title:'Synthetic'}}).format,'pdf');
 assert.throws(()=>parseGaizToolRequest({toolId:'demo',format:'exe',inputs:{}}));
 assert.throws(()=>parseGaizToolRequest({toolId:'demo',format:'pdf',inputs:{note:'x'.repeat(70000)}}));
 assert.throws(()=>parseGaizToolRequest({toolId:undefined,format:'pdf',inputs:{}}));
});
test('job status and outputs cannot invent completion',()=>{
 assert.throws(()=>parseGaizJobResponse({jobId:'job1',status:'completed'}));
 assert.throws(()=>parseGaizJobResponse({jobId:'job1',status:'approved'}));
 const result=parseGaizJobResponse({jobId:'job1',status:'completed',outputs:[{artifactId:'demo1',format:'gaiz'}]});
 assert.equal(result.outputs[0].format,'gaiz');
});
test('server must establish verified tenant context before additional authorization',()=>{
 assert.throws(()=>requireGaizServicePrincipal({userId:'a',tenantId:'a'},{expectedTenantId:'b'}));
 assert.throws(()=>requireGaizServicePrincipal({userId:undefined,tenantId:'a'},{expectedTenantId:'a'}));
 assert.deepEqual(requireGaizServicePrincipal({userId:'a',tenantId:'a'},{expectedTenantId:'a'}),{userId:'a',tenantId:'a'});
});
