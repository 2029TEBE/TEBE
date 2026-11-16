/**
 * Read-only Stripe sandbox webhook endpoint preflight. Never creates
 * endpoints, test payments or changes Stripe state; never prints secrets.
 *
 * Run separately from local configuration preflight:
 * node scripts/stripe-webhook-endpoint-audit.mjs
 */
import { fileURLToPath } from 'node:url';
import { checkStripeStagingConfig } from './stripe-staging-preflight.mjs';

const EVENTS=Object.freeze([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
]);

const fail=reason=>{throw Error('Stripe staging webhook endpoint audit: '+reason)};

export function inspectStripeWebhookEndpoints(data,expectedUrl){
  if(!data||data.object!=='list'||!Array.isArray(data.data)||
     typeof expectedUrl!=='string')fail('invalid endpoint response');
  const matching=data.data.filter(e=>e&&e.url===expectedUrl);
  // If the list is paginated, we can still identify exact matches on the
  // current page; never assert absence without checking all pages.
  if(matching.length===0){
    if(data.has_more===true)fail('endpoint not on first page; inspect pagination');
    fail('no matching test-mode webhook endpoint registered');
  }
  const valid=matching.filter(e=>{
    if(e.livemode!==false||e.status!=='enabled'||!Array.isArray(e.enabled_events))
      return false;
    return EVENTS.every(event=>e.enabled_events.includes(event)||e.enabled_events.includes('*'));
  });
  if(valid.length!==1)fail('expected exactly one enabled test webhook with all required event types');
  return Object.freeze({ready:true,endpointId:valid[0].id,requiredEvents:[...EVENTS]});
}

export async function auditStripeStagingWebhook(env,fetchImpl=fetch){
  // Require complete staging config before *any* external network access.
  const invalid=checkStripeStagingConfig(env).filter(c=>!c.passed);
  if(invalid.length)fail('local staging configuration incomplete');
  const key=env.STRIPE_SECRET_KEY;
  // Stripe API may paginate at 100 endpoints; fail closed on ambiguous lists.
  let response;
  try{
    response=await fetchImpl('https://api.stripe.com/v1/webhook_endpoints?limit=100',{
      method:'GET',
      redirect:'error',
      headers:{Authorization:`Bearer ${key}`},
      signal:AbortSignal.timeout(12000),
    });
  }catch{fail('Stripe endpoint listing unavailable')}
  if(!response||response.status!==200)fail('Stripe endpoint listing failed');
  let data;
  try{data=await response.json()}catch{fail('Stripe endpoint listing invalid JSON')}
  return inspectStripeWebhookEndpoints(data,env.STRIPE_WEBHOOK_PUBLIC_URL);
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  auditStripeStagingWebhook(process.env).then(result=>{
    console.log('PASS: matching test-mode Stripe webhook endpoint',result.endpointId);
    console.log('Required event types:',result.requiredEvents.join(', '));
    console.log('NOTE: endpoint registration does not verify webhook delivery or payment settlement.');
  }).catch(error=>{
    console.error(error instanceof Error?error.message:'Stripe staging webhook audit failed');
    process.exitCode=1;
  });
}
