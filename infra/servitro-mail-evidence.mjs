// S26: local-only, fail-closed mail receipt validator. No network calls or credentials.
const SHA=/^[a-f0-9]{40}$/i;
const TYPES=['inbound','outbound','smtp-tls','imap-tls','dkim','ptr','spf','dmarc'];
export function validateMailEvidence(value, now=Date.now()) {
 const errors=[];
 if (!value || typeof value!=='object' || Array.isArray(value)) return {accepted:false,errors:['invalid evidence'],operationallyVerified:false};
 for(const key of Object.keys(value)) if(!['releaseSha','domain','receipts'].includes(key)) errors.push('unexpected field');
 if(!SHA.test(value.releaseSha||'')) errors.push('invalid release SHA');
 if(value.domain!=='theepmo.com') errors.push('unexpected domain');
 if(!Array.isArray(value.receipts)||value.receipts.length!==TYPES.length) errors.push('incomplete receipts');
 const seen=new Set();
 for(const receipt of Array.isArray(value.receipts)?value.receipts:[]) {
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)){errors.push('invalid receipt');continue;}
  for(const key of Object.keys(receipt)) if(!['type','status','observedAt','reference','source','releaseSha'].includes(key)) errors.push('unexpected receipt field');
  if(!TYPES.includes(receipt.type)||seen.has(receipt.type)) errors.push('duplicate or unknown receipt');
  seen.add(receipt.type);
  if(receipt.status!=='pass') errors.push('failed receipt');
  if(receipt.releaseSha!==value.releaseSha) errors.push('release mismatch');
  if(typeof receipt.reference!=='string'||!/^https:\/\/[^\s]+$/.test(receipt.reference)||receipt.reference.length>1024||/@/.test(receipt.reference)) errors.push('unsafe evidence reference');
  if(typeof receipt.source!=='string'||!['independent-runner','operator-attested','provider-attested'].includes(receipt.source)) errors.push('untrusted evidence source');
  const t=Date.parse(receipt.observedAt);
  if(!Number.isFinite(t)||t>now+60000||now-t>86400000) errors.push('stale evidence');
 }
 for(const type of TYPES) if(!seen.has(type)) errors.push('missing '+type);
 return {accepted:errors.length===0,errors:[...new Set(errors)],operationallyVerified:false,deploymentAuthorized:false};
}
if(process.argv[1]?.endsWith('servitro-mail-evidence.mjs')&&process.argv[2]) {
 const {readFileSync,lstatSync}=await import('node:fs');
 try { const p=process.argv[2];const s=lstatSync(p);if(!s.isFile()||s.size>1048576) throw Error('invalid file');const result=validateMailEvidence(JSON.parse(readFileSync(p,'utf8')));console.log(JSON.stringify(result));process.exitCode=result.accepted?0:1;} catch {console.error('mail evidence rejected');process.exitCode=1;}
}
