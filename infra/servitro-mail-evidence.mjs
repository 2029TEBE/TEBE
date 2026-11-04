// S26: local-only, fail-closed mail receipt validator. No network calls or credentials.
const SHA=/^[a-f0-9]{40}$/i;
const TYPES=['inbound','outbound','smtp-tls','imap-tls','dkim','ptr','spf','dmarc'];
// References are navigation pointers, never proof of authenticity. Reject local targets and URL tricks.
export function safeEvidenceUrl(input) {
 if(typeof input!=='string'||input.length>1024||/\\s|[\\x00-\\x1f\\x7f]/.test(input)) return false;
 try {
  const u=new URL(input);
  if(u.protocol!=='https:'||!u.hostname||u.username||u.password||u.hash||u.port) return false;
  if(!/^https:\\/\\/[^/?#]+(?:[/?]|$)/.test(input)) return false;
  const host=u.hostname.toLowerCase().replace(/\\.$/,'');
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')) return false;
  if(/^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(host)||host.startsWith('[')||host==='0') return false;
  if(!host.includes('.')||host.includes('..')) return false;
  return true;
 } catch {return false;}
}
export function validateMailEvidence(value, now=Date.now()) {
 const errors=[];
 if (!value || typeof value!=='object' || Array.isArray(value)) return {accepted:false,errors:['invalid evidence'],operationallyVerified:false};
 for(const key of Object.keys(value)) if(!['releaseSha','domain','receipts'].includes(key)) errors.push('unexpected field');
 if(typeof value.releaseSha!=='string'||!SHA.test(value.releaseSha)) errors.push('invalid release SHA');
 if(value.domain!=='theepmo.com') errors.push('unexpected domain');
 if(!Array.isArray(value.receipts)||value.receipts.length!==TYPES.length) errors.push('incomplete receipts');
 if(!Number.isFinite(now)) errors.push('invalid clock');
 const seen=new Set();
 for(const receipt of Array.isArray(value.receipts)?value.receipts:[]) {
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)){errors.push('invalid receipt');continue;}
  for(const key of Object.keys(receipt)) if(!['type','status','observedAt','reference','source','releaseSha'].includes(key)) errors.push('unexpected receipt field');
  if(!TYPES.includes(receipt.type)||seen.has(receipt.type)) errors.push('duplicate or unknown receipt');
  seen.add(receipt.type);
  if(receipt.status!=='pass') errors.push('failed receipt');
  if(receipt.releaseSha!==value.releaseSha) errors.push('release mismatch');
  if(!safeEvidenceUrl(receipt.reference)) errors.push('unsafe evidence reference');
  if(typeof receipt.source!=='string'||!['independent-runner','operator-attested','provider-attested'].includes(receipt.source)) errors.push('untrusted evidence source');
  // Require a canonical UTC timestamp. Date.parse coerces arbitrary objects and may throw on Symbols.
  const timestamp=receipt.observedAt;
  const canonical=typeof timestamp==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp);
  const t=canonical?Date.parse(timestamp):NaN;
  if(!Number.isFinite(t)||new Date(t).toISOString()!==timestamp||t>now+60000||now-t>86400000) errors.push('stale or invalid evidence timestamp');
 }
 for(const type of TYPES) if(!seen.has(type)) errors.push('missing '+type);
 return {accepted:errors.length===0,errors:[...new Set(errors)],operationallyVerified:false,deploymentAuthorized:false};
}
// Read evidence through a single no-follow descriptor; reject symlinks, devices and oversized files.
// This guards local CLI ingestion, not the authenticity of operator/provider evidence.
export async function readMailEvidenceFile(path) {
 const {open}=await import('node:fs/promises');
 const {constants:fsConstants}=await import('node:fs');
 let handle;
 try {
  handle=await open(path,fsConstants.O_RDONLY|fsConstants.O_NOFOLLOW|fsConstants.O_NONBLOCK);
  const stat=await handle.stat();
  if(!stat.isFile()||stat.size>1048576||stat.size===0) throw Error('invalid evidence file');
  const data=await handle.readFile({encoding:'utf8'});
  if(Buffer.byteLength(data,'utf8')>1048576) throw Error('oversized evidence file');
  return JSON.parse(data);
 } finally {await handle?.close();}
}
if(process.argv[1]?.endsWith('servitro-mail-evidence.mjs')&&process.argv[2]) {
 try {const result=validateMailEvidence(await readMailEvidenceFile(process.argv[2]));console.log(JSON.stringify(result));process.exitCode=result.accepted?0:1;}
 catch {console.error('mail evidence rejected');process.exitCode=1;}
}
