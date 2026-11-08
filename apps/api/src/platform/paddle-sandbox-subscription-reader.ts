/**
 * Read-only Paddle Sandbox transaction/subscription cross-check.
 * Does not mark invoices paid or grant entitlements. NEVER expose API keys.
 * Only a trusted backend caller may use these independently retrieved values
 * in conjunction with an immutable tenant-owned database binding.
 */
const TXN=/^txn_[a-z0-9]{26}$/;
const SUB=/^sub_[a-z0-9]{26}$/;
const PRICE='pri_01m6x7w5zy16nktzjwg2ezas2d';
type Evidence={source:'authenticated-paddle-sandbox-get';transactionId:string;
  subscriptionId:string;customerId:string;priceId:string;status:'completed';
  amountMinor:number;currency:'USD'};
type Result={verified:boolean;reason:string;provider?:Evidence;
  invoiceMarkedPaid:false;entitlementGranted:false};
const deny=(reason:string):Result=>({verified:false,reason,invoiceMarkedPaid:false,entitlementGranted:false});

export async function readPaddleSandboxSubscriptionEvidence({
  transactionId,subscriptionId,env=process.env,fetchImpl=globalThis.fetch,
}:{
  transactionId:string;subscriptionId:string;
  env?:NodeJS.ProcessEnv;fetchImpl?:typeof fetch;
}):Promise<Result>{
  if(env.PADDLE_ENV!=='sandbox'||env.PADDLE_ENABLED!=='false'||
     env.BILLING_PROVIDER!=='paddle'||env.PADDLE_SUBSCRIPTION_READONLY!=='true'||
     !['development','staging'].includes(env.DEPLOYMENT_ENV||''))
    return deny('sandbox_read_only_gate_required');
  if(!TXN.test(transactionId||'')||!SUB.test(subscriptionId||''))
    return deny('invalid_provider_identifiers');
  const key=env.PADDLE_SANDBOX_API_KEY;
  if(typeof key!=='string'||!/^pdl_sdbx_apikey_[A-Za-z0-9_-]{20,}$/.test(key)||
     typeof fetchImpl!=='function')
    return deny('sandbox_credentials_unavailable');
  const get=async(path:string)=>{
    const response=await fetchImpl('https://sandbox-api.paddle.com'+path,{
      method:'GET',redirect:'error',
      headers:{Authorization:'Bearer '+key,Accept:'application/json'},
      signal:AbortSignal.timeout(8000)
    });
    if(!response||response.status!==200||response.ok!==true||
       !String(response.headers?.get('content-type')||'').toLowerCase().includes('application/json'))
      throw new Error('provider_read_failed');
    const body=(await response.json()) as {data?:unknown};
    if(!body?.data||typeof body.data!=='object'||Array.isArray(body.data))
      throw new Error('invalid_provider_data');
    return body.data as Record<string,any>;
  };
  try{
    const transaction=await get('/transactions/'+transactionId);
    if(transaction.id!==transactionId||transaction.status!=='completed'||
       transaction.subscription_id!==subscriptionId||
       transaction.currency_code!=='USD'||
       !Array.isArray(transaction.details?.line_items)||
       transaction.details.line_items.length!==1||
       transaction.details.line_items[0]?.price_id!==PRICE||
       transaction.details.line_items[0]?.quantity!==1||
       transaction.details?.totals?.grand_total!=='4900')
      return deny('provider_transaction_mismatch');
    const subscription=await get('/subscriptions/'+subscriptionId);
    if(typeof transaction.customer_id!=='string'||!/^ctm_[a-z0-9]{26}$/.test(transaction.customer_id)||
       subscription.customer_id!==transaction.customer_id||
       subscription.id!==subscriptionId||subscription.status!=='active'||
       !Array.isArray(subscription.items)||subscription.items.length!==1||
       subscription.items[0]?.price?.id!==PRICE||
       subscription.items[0]?.quantity!==1)
      return deny('provider_subscription_mismatch');
    return {verified:true,reason:'provider_read_only_consistency_only',
      provider:{source:'authenticated-paddle-sandbox-get',transactionId,
        subscriptionId,customerId:transaction.customer_id as string,
        priceId:PRICE,status:'completed',amountMinor:4900,currency:'USD'},
      invoiceMarkedPaid:false,entitlementGranted:false};
  }catch{
    // Never leak API secrets, provider responses, or customer metadata.
    return deny('sandbox_subscription_api_not_verified');
  }
}
