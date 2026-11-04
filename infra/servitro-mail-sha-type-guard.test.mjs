import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMailEvidence} from './servitro-mail-evidence.mjs';
const sha='a'.repeat(40);
const types=['inbound','outbound','smtp-tls','imap-tls','dkim','ptr','spf','dmarc'];
const now=Date.parse('2026-11-04T02:00:00.000Z');
const valid=()=>({releaseSha:sha,domain:'theepmo.com',receipts:types.map(type=>({type,status:'pass',observedAt:new Date(now).toISOString(),reference:'https://evidence.example.org/proof',source:'independent-runner',releaseSha:sha}))});
for(const [name,bad] of [['symbol',Symbol('sha')],['throwing object',{toString(){throw Error('must not coerce');}}],['array',[sha]],['number',123],['null',null],['boolean',true]]) {
 test('reject '+name+' release SHA without coercion or exception',()=>{
  const input=valid(); input.releaseSha=bad;
  assert.doesNotThrow(()=>validateMailEvidence(input,now));
  assert.equal(validateMailEvidence(input,now).accepted,false);
 });
}
test('well-formed synthetic receipts remain metadata-only',()=>{
 const result=validateMailEvidence(valid(),now);
 assert.equal(result.accepted,true);
 assert.equal(result.operationallyVerified,false);
 assert.equal(result.deploymentAuthorized,false);
});
