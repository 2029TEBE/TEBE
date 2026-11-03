import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProbeReceipt} from './servitro-probe-contract.mjs';
const releaseSha='a'.repeat(40),imageDigest='sha256:'+'b'.repeat(64),now=new Date('2026-11-03T17:00:00Z');
const base=()=>({releaseSha,imageDigest,environment:'isolated-nonproduction',observedAt:'2026-11-03T16:59:00Z',url:'https://staging.example.test/ready',status:200,tls:{verified:true,version:'TLSv1.3',expiresAt:'2026-12-03T00:00:00Z'},latencyMs:45,ready:true,source:'independent-readonly-probe'});
const check=r=>validateProbeReceipt(r,{releaseSha,imageDigest,now});
test('synthetic valid receipt is offline accepted but not operational proof',()=>{const x=check(base());assert.equal(x.accepted,true);assert.equal(x.operationallyVerified,false);});
for(const [name,edit] of [
 ['wrong SHA',r=>r.releaseSha='c'.repeat(40)],['wrong digest',r=>r.imageDigest='sha256:'+'c'.repeat(64)],
 ['production',r=>r.environment='production'],['untrusted source',r=>r.source='app-self-report'],
 ['insecure URL',r=>r.url='http://staging.example.test/ready'],['URL credentials',r=>r.url='https://user:pass@staging.example.test/ready'],
 ['URL query',r=>r.url='https://staging.example.test/ready?token=private'],['local address',r=>r.url='https://127.0.0.1/ready'],
 ['not ready',r=>r.ready=false],['http failure',r=>r.status=503],['invalid TLS',r=>r.tls.verified=false],
 ['expired cert',r=>r.tls.expiresAt='2026-11-04T00:00:00Z'],['stale',r=>r.observedAt='2026-11-03T16:40:00Z'],
 ['future',r=>r.observedAt='2026-11-03T17:01:00Z'],['slow',r=>r.latencyMs=15000],
 ['secret field',r=>r.authorization='Bearer secret']]){
 test('reject '+name,()=>{const r=base();edit(r);assert.equal(check(r).accepted,false);});
}
test('malformed receipt fails closed without leaking input',()=>{assert.equal(check(null).accepted,false);assert.equal(JSON.stringify(check({...base(),authorization:'Bearer secret'})).includes('secret'),false);});
