/**
 * Read-only Paddle Sandbox price-to-product audit.
 * No checkout, mutations, customer data, logging of API response or secrets.
 * Requires an explicitly supplied sandbox API key in a trusted CI/staging shell.
 */
const PRICE='pri_01m6x7w5zy16nktzjwg2ezas2d';
const PRODUCT='pro_01m6x789k8kmvez6zk7cm17wdz';
const deny=reason=>({ok:false,reason,verified:false,realPaymentsEnabled:false});

export async function verifyTeamWorkspaceSandboxCatalog({
 env=process.env, fetchImpl=globalThis.fetch
}={}) {
 if(env.PADDLE_CATALOG_PREFLIGHT!=='READ_ONLY'||
   env.BILLING_PROVIDER!=='paddle'||env.PADDLE_ENV!=='sandbox'||
   env.PADDLE_ENABLED!=='false'||
   !['development','staging'].includes(env.DEPLOYMENT_ENV))
   return deny('sandbox_read_only_gate_required');
 const key=env.PADDLE_SANDBOX_API_KEY;
 if(typeof key!=='string'||!/^pdl_sdbx_apikey_[A-Za-z0-9_-]{20,}$/.test(key)||
   typeof fetchImpl!=='function')
   return deny('sandbox_read_credentials_not_configured');
 const request=async path=>{
   const response=await fetchImpl('https://sandbox-api.paddle.com'+path,{
     method:'GET',redirect:'error',cache:'no-store',
     headers:{Authorization:'Bearer '+key,Accept:'application/json'},
     signal:AbortSignal.timeout(8000)
   });
   if(response?.status!==200||response.ok!==true||
     !String(response.headers?.get?.('content-type')||'').toLowerCase().includes('application/json'))
     throw new Error('read_failed');
   const body=await response.json();
   if(!body||typeof body!=='object'||!body.data||Array.isArray(body.data))
     throw new Error('invalid_response');
   return body.data;
 };
 try {
   // Exact-ID GET calls avoid pagination truncation and unrelated catalog data.
   const price=await request('/prices/'+PRICE);
   const product=await request('/products/'+PRODUCT);
   const valid=price.id===PRICE&&price.product_id===PRODUCT&&price.status==='active'&&
     price.type==='standard'&&price.billing_cycle?.interval==='month'&&
     price.billing_cycle?.frequency===1&&price.trial_period===null&&
     price.unit_price?.amount==='4900'&&price.unit_price?.currency_code==='USD'&&
     // Country-specific price overrides can silently alter the $49 advertised
     // amount. Refuse catalog verification unless this plan has none.
     Array.isArray(price.unit_price_overrides)&&price.unit_price_overrides.length===0&&
     price.quantity?.minimum===1&&
     Number.isSafeInteger(price.quantity?.maximum)&&price.quantity.maximum>=1&&
     product.id===PRODUCT&&product.status==='active'&&product.type==='standard'&&
     product.name==='THE EPMO — Team Workspace';
   return valid
     ? {ok:true,verified:true,reason:'exact_sandbox_catalog_verified',realPaymentsEnabled:false}
     : deny('catalog_product_price_or_terms_mismatch');
 } catch {
   return deny('sandbox_catalog_api_not_verified');
 }
}

if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
 const result=await verifyTeamWorkspaceSandboxCatalog();
 console.log(JSON.stringify(result));
 if(!result.ok) process.exitCode=2;
}
