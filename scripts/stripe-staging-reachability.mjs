/**
 * Read-only pre-registration check. Do not point Stripe at an unverified API.
 * No writes to DNS, Stripe, databases or billing configuration.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';

const fail=reason=>{throw new Error('Stripe staging reachability blocked: '+reason)};
const privateAddress=address=>{
  const kind=isIP(address);
  if(kind===4){
    const [a,b,c]=address.split('.').map(Number);
    return a===0||a===10||a===127||a>=224||
      a===169&&b===254||a===172&&b>=16&&b<=31||
      a===192&&b===168||a===100&&b>=64&&b<=127||
      a===198&&b>=18&&b<=19||
      a===192&&b===0&&c===2||a===198&&b===51&&c===100||
      a===203&&b===0&&c===113;
  }
  if(kind===6){
    const lower=address.toLowerCase();
    return lower==='::1'||lower==='::'||lower.startsWith('fc')||
      lower.startsWith('fd')||lower.startsWith('fe8')||
      lower.startsWith('fe9')||lower.startsWith('fea')||
      lower.startsWith('feb')||lower.startsWith('::ffff:');
  }
  return true;
};

export function stripeStagingHealthUrl(env){
  if(env?.DEPLOYMENT_ENV!=='staging')fail('staging environment required');
  const input=env.STRIPE_WEBHOOK_PUBLIC_URL;
  if(typeof input!=='string')fail('webhook URL not configured');
  let url;
  try{url=new URL(input)}catch{fail('invalid webhook URL')}
  if(url.protocol!=='https:'||url.username||url.password||
     url.search||url.hash||url.port||url.pathname!=='/api/v1/billing/stripe-webhook'||
     url.toString()!==input||isIP(url.hostname)||url.hostname==='localhost'||
     url.hostname.endsWith('.localhost')||url.hostname.endsWith('.internal')||
     !/(^|[.-])(staging|stage|test)([.-]|$)/i.test(url.hostname))
     fail('requires a dedicated public HTTPS staging webhook URL');
  return Object.freeze({
    hostname:url.hostname,
    healthUrl:url.origin+'/health',
  });
}

export async function verifyStripeStagingReachability(env,{
  lookupFn=(host)=>lookup(host,{all:true}),fetchFn=fetch,
}={}){
  const target=stripeStagingHealthUrl(env);
  let records;
  try{records=await lookupFn(target.hostname)}catch{fail('DNS lookup failed')}
  if(!Array.isArray(records)||records.length===0||
     records.some(r=>!r||typeof r.address!=='string'||privateAddress(r.address)))
     fail('DNS has no valid public address records');
  let response;
  try{
    response=await fetchFn(target.healthUrl,{
      method:'GET',redirect:'manual',cache:'no-store',
      signal:AbortSignal.timeout(10000),
    });
  }catch{fail('staging API health endpoint unreachable')}
  if(!response||response.status!==200||response.redirected===true)
    fail('staging API health returned a non-200 or redirect');
  let json;
  try{json=await response.json()}catch{fail('invalid health JSON')}
  if(!json||json.ok!==true||json.service!=='pmo-api')
    fail('staging endpoint does not identify the THEEPMO API');
  return Object.freeze({ready:true,healthUrl:target.healthUrl,hostname:target.hostname});
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  verifyStripeStagingReachability(process.env).then(result=>{
    console.log('PASS: staging API identity and reachability verified',result.healthUrl);
    console.log('NOTE: this does not verify webhooks, payment delivery, or database settlement.');
  }).catch(error=>{
    console.error(error instanceof Error?error.message:'Stripe staging health verification blocked');
    process.exitCode=1;
  });
}
