// Read-only observation contract. Does not issue network requests or authorize deployment.
const SHA=/^[0-9a-f]{40}$/;
const REQUIRED=Object.freeze({
  apex:'https://theepmo.com/',
  login:'https://app.theepmo.com/login',
  signup:'https://app.theepmo.com/signup'
});
export function assessPublicRoutes(input,{now=new Date(),maxAgeMs=300000}={}){
 const failures=[];
 if(!input||typeof input!=='object'||Array.isArray(input)) return {accepted:false,failures:['invalid-input'],deploymentAuthorized:false};
 if(!SHA.test(input.candidateSha??'')) failures.push('candidate-sha');
 if(input.signupMode!=='account-registration') failures.push('signup-is-not-account-registration');
 if(!Array.isArray(input.observations)||input.observations.length!==3) failures.push('observation-count');
 const seen=new Set();
 for(const item of Array.isArray(input.observations)?input.observations:[]){
  if(!item||typeof item!=='object'||Array.isArray(item)){failures.push('invalid-observation');continue;}
  if(Object.keys(item).some(k=>!['route','url','status','observedAt','tlsVerified','redirected','source'].includes(k))) failures.push('unexpected-field');
  if(!(item.route in REQUIRED)||seen.has(item.route)){failures.push('duplicate-or-unknown-route');continue;}
  seen.add(item.route);
  if(item.url!==REQUIRED[item.route]||item.redirected!==false) failures.push(item.route+':url-or-redirect');
  if(item.status!==200) failures.push(item.route+':http-status');
  if(item.tlsVerified!==true||item.source!=='independent-readonly-probe') failures.push(item.route+':unverified-tls-or-source');
  const t=Date.parse(item.observedAt),n=now instanceof Date?now.getTime():NaN;
  if(typeof item.observedAt!=='string'||!Number.isFinite(t)||!Number.isFinite(n)||t>n||n-t>maxAgeMs||maxAgeMs<=0||maxAgeMs>300000) failures.push(item.route+':stale');
 }
 for(const route of Object.keys(REQUIRED)) if(!seen.has(route)) failures.push(route+':missing');
 return {accepted:failures.length===0,failures:[...new Set(failures)],deploymentAuthorized:false,operationallyVerified:false};
}
