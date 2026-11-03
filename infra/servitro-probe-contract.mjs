// S22: validate supplied probe receipts without making network requests.
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^sha256:[a-f0-9]{64}$/;
const allowed=new Set(['releaseSha','imageDigest','environment','observedAt','url','status','tls','latencyMs','ready','source']);
export function validateProbeReceipt(receipt,{releaseSha,imageDigest,now=new Date(),maxAgeMs=300000}={}){
 const errors=[];
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)) return {accepted:false,errors:['invalid-receipt'],operationallyVerified:false,deploymentAuthorized:false};
 if(Object.keys(receipt).some(k=>!allowed.has(k))) errors.push('unknown-field');
 if(!SHA.test(releaseSha??'')||receipt.releaseSha!==releaseSha) errors.push('release-sha');
 if(!DIGEST.test(imageDigest??'')||receipt.imageDigest!==imageDigest) errors.push('image-digest');
 if(receipt.environment!=='isolated-nonproduction') errors.push('environment');
 if(receipt.source!=='independent-readonly-probe') errors.push('source');
 try {
  const u=new URL(receipt.url);
  if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||u.port&&u.port!=='443'||!u.hostname||u.hostname==='localhost'||u.hostname.endsWith('.localhost')||/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)||!['/health','/ready','/healthz','/readyz'].includes(u.pathname)) errors.push('url');
 } catch {errors.push('url');}
 if(receipt.status!==200||receipt.ready!==true) errors.push('readiness');
 if(!Number.isFinite(receipt.latencyMs)||receipt.latencyMs<0||receipt.latencyMs>10000) errors.push('latency');
 if(!receipt.tls||typeof receipt.tls!=='object'||Array.isArray(receipt.tls)||Object.keys(receipt.tls).some(k=>!['verified','version','expiresAt'].includes(k))||receipt.tls.verified!==true||!['TLSv1.2','TLSv1.3'].includes(receipt.tls.version)) errors.push('tls');
 const timestamp=Date.parse(receipt.observedAt);
 const current=now instanceof Date?now.getTime():NaN;
 if(typeof receipt.observedAt!=='string'||!Number.isFinite(timestamp)||!Number.isFinite(current)||timestamp>current||current-timestamp>maxAgeMs||maxAgeMs>300000||maxAgeMs<=0) errors.push('freshness');
 const expiry=Date.parse(receipt.tls?.expiresAt);
 if(!Number.isFinite(expiry)||expiry-current<7*86400000) errors.push('certificate-expiry');
 return {accepted:errors.length===0,errors,operationallyVerified:false,deploymentAuthorized:false};
}
