import test from 'node:test';import assert from 'node:assert/strict';import {validateMailEvidence,safeEvidenceUrl} from './servitro-mail-evidence.mjs';
const now=Date.parse('2026-11-04T00:00:00Z'),sha='a'.repeat(40),types=['inbound','outbound','smtp-tls','imap-tls','dkim','ptr','spf','dmarc'];
const valid=()=>({releaseSha:sha,domain:'theepmo.com',receipts:types.map(type=>({type,status:'pass',observedAt:new Date(now-1000).toISOString(),reference:'https://example.org/evidence/'+type,source:'independent-runner',releaseSha:sha}))});
test('valid metadata never proves operations',()=>{const x=validateMailEvidence(valid(),now);assert.equal(x.accepted,true);assert.equal(x.operationallyVerified,false)});
for(const [name,mutate] of [['missing inbound',x=>x.receipts.shift()],['failed smtp',x=>x.receipts[2].status='fail'],['stale receipt',x=>x.receipts[0].observedAt='2020-01-01'],['future receipt',x=>x.receipts[0].observedAt='2030-01-01'],['wrong release',x=>x.receipts[0].releaseSha='b'.repeat(40)],['duplicate receipt',x=>x.receipts[0].type='outbound'],['embedded credentials',x=>x.receipts[0].reference='https://user:pass@example.org/a'],['unexpected secret',x=>x.receipts[0].password='secret'],['untrusted source',x=>x.receipts[0].source='self'],['bad domain',x=>x.domain='example.org']]) test(name,()=>{const x=valid();mutate(x);assert.equal(validateMailEvidence(x,now).accepted,false)});

test('evidence URL rejects SSRF and URL confusion',()=>{
 for(const url of ['http://example.org/x','https://localhost/x','https://127.0.0.1/x','https://10.0.0.1/x','https://[::1]/x','https://user:pass@example.org/x','https://example.org:8443/x','https://example.org/#token','https://service.internal/x','https://example.org\\n.evil/x','https://example.org@evil.com/x','https://example.org\\\\@evil.com/x']){
  assert.equal(safeEvidenceUrl(url),false,url);
  const x=valid();x.receipts[0].reference=url;assert.equal(validateMailEvidence(x,now).accepted,false,url);
 }
 assert.equal(safeEvidenceUrl('https://evidence.example.org/path?id=1'),true);
});
test('nonfinite clock cannot validate receipts',()=>assert.equal(validateMailEvidence(valid(),NaN).accepted,false));
