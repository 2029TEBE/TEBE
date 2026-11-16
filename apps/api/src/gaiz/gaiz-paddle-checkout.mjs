// ORGAIZ Paddle checkout policy (source-only). Independent of EPMO subscriptions.
// No API calls, checkout routes, purchase authorization or live entitlements here.
// All identifiers and prices must originate in trusted server-side records.
const fail=()=>{throw Error('ORGAIZ Paddle checkout denied')};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const price=/^pri_[a-z0-9]{26}$/;
const txn=/^txn_[a-z0-9]{26}$/;
function baseUrl(value){
 if(typeof value!=='string')fail();
 let url;try{url=new URL(value)}catch{fail()}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||
    url.hash||!url.hostname||!url.pathname.endsWith('/')||
    url.hostname==='localhost'||url.hostname.endsWith('.local'))fail();
 return url;
}
/** Accept only a server-priced, authenticated ORGAIZ customer order.
 * Caller must already create a unique order in a transactional store and
 * reserve a stable provider idempotency key; this does not do so. */
export function buildGaizPaddleCheckoutIntent({principal,order,product,checkoutBase}={}){
 if(!principal||principal.authenticated!==true||
    principal.identityProvider!=='oidc'||principal.epmoTenantBound!==false||
    !uuid.test(principal.customerId||'')||
    !order||!uuid.test(order.id||'')||
    order.customerId!==principal.customerId||
    order.state!=='created'||!Number.isSafeInteger(order.revision)||order.revision!==0||
    !product||product.active!==true||!price.test(product.paddlePriceId||'')||
    product.toolId!==order.toolId||product.productId!==order.productId||
    !Number.isSafeInteger(product.amountMinor)||product.amountMinor<=0||
    product.amountMinor!==order.amountMinor||product.currency!==order.currency||
    !/^[A-Z]{3}$/.test(product.currency||''))fail();
 const base=baseUrl(checkoutBase);
 return Object.freeze({
  collection_mode:'automatic',
  items:Object.freeze([{price_id:product.paddlePriceId,quantity:1}]),
  checkout:Object.freeze({url:base.href}),
  custom_data:Object.freeze({orgaiz_order_id:order.id}),
  // NO EPMO tenant ID, customer claims or server price accepted from the browser.
 });
}
/** A checkout URL is never payment proof. Verify the exact provider transaction
 * identity, price and server-owned order binding before returning its URL. */
export function validateGaizPaddleCheckoutResponse({response,order,product,checkoutBase}={}){
 const base=baseUrl(checkoutBase);
 if(!response||typeof response!=='object'||Array.isArray(response)||
   !response.data||typeof response.data!=='object')fail();
 const data=response.data;
 if(!txn.test(data.id||'')||!['draft','ready'].includes(data.status)||
    data.collection_mode!=='automatic'||data.custom_data?.orgaiz_order_id!==order?.id||
    !Array.isArray(data.items)||data.items.length!==1||
    data.items[0]?.price?.id!==product?.paddlePriceId||
    data.items[0]?.quantity!==1||typeof data.checkout?.url!=='string')fail();
 let url;try{url=new URL(data.checkout.url)}catch{fail()}
 if(url.protocol!=='https:'||url.origin!==base.origin||
    url.pathname!==base.pathname||url.hash||url.username||url.password||
    url.searchParams.get('_ptxn')!==data.id||
    [...url.searchParams.keys()].some(k=>k!=='_ptxn'))fail();
 return Object.freeze({provider:'paddle',providerTransactionId:data.id,
  checkoutUrl:url.toString(),paymentVerified:false,orderId:order.id});
}
