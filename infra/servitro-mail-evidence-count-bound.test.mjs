import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMailEvidence} from './servitro-mail-evidence.mjs';
const sha='a'.repeat(40);
test('oversized receipt collection is rejected without reading its elements',()=>{
 const receipts=new Array(1000000);
 Object.defineProperty(receipts,0,{get(){throw Error('must not inspect oversized receipts');}});
 const input={releaseSha:sha,domain:'theepmo.com',receipts};
 let result;
 assert.doesNotThrow(()=>{result=validateMailEvidence(input,Date.now());});
 assert.equal(result.accepted,false);
 assert.equal(result.operationallyVerified,false);
 assert.equal(result.deploymentAuthorized,false);
 assert.ok(result.errors.includes('incomplete receipts'));
});
test('short receipt collection is rejected without coercing contents',()=>{
 const receipts=[Symbol('untrusted')];
 const result=validateMailEvidence({releaseSha:sha,domain:'theepmo.com',receipts});
 assert.equal(result.accepted,false);
 assert.ok(result.errors.includes('incomplete receipts'));
});
