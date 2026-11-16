// GAIZ Stripe Checkout - source-only, intentionally unregistered.
// Stripe is not enabled until the merchant entity and account are verified.
// No caller-provided price, account, tenant or payment status is trusted.
const deny=()=>{throw Error('ORGAIZ Stripe checkout denied')};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const price=x=>typeof x==='string'&&/^price_[A-Za-z0-9]{8,100}$/.test(x);
const session=x=>typeof x==='string'&&/^cs_(test|live)_[A-Za-z0-9]{8,200}$/.test(x);
function absoluteHttps(x,host){
 let u;try{u=new URL(x)}catch{deny()}
 if(typeof x!=='string'||u.protocol!=='https:'||u.username||u.password||
    u.port||u.hash||u.search||!u.hostname||
    (host&&u.hostname!==host))deny();
 return u;
}
/** The server must first persist the immutable order/product selection and
 * then use a stable Stripe idempotency key when creating this session. */
export function gaizStripeCheckoutParams({principal,order,product,successUrl,cancelUrl}={}){
 if(!principal||principal.authenticated!==true||
   principal.identityProvider!=='oidc'||principal.epmoTenantBound!==false||
   !uuid(principal.customerId)||!order||!uuid(order.id)||
   order.customerId!==principal.customerId||order.state!=='created'||
   order.revision!==0||!product||product.active!==true||
   !price(product.stripePriceId)||product.toolId!==order.toolId||
   product.productId!==order.productId||
   product.amountMinor!==order.amountMinor||
   product.currency!==order.currency||
   !Number.isSafeInteger(order.amountMinor)||order.amountMinor<=0||
   !/^[A-Z]{3}$/.test(order.currency||''))deny();
 const ok=absoluteHttps(successUrl),cancel=absoluteHttps(cancelUrl);
 if(ok.origin!==cancel.origin||!ok.pathname.startsWith('/account/')||
   !cancel.pathname.startsWith('/account/'))deny();
 return Object.freeze({
  mode:'payment',line_items:[{price:product.stripePriceId,quantity:1}],
  client_reference_id:order.id,
  metadata:{orgaiz_order_id:order.id},
  success_url:ok.href,cancel_url:cancel.href
 });
}
/** Stripe-hosted Checkout must be an exact Stripe URL and session bound to
 * a canonical server-created order. URL is NEVER proof of payment. */
export function gaizStripeCheckoutResponse({response,order,environment}={}){
 if(!response||!order||!uuid(order.id)||!['test','live'].includes(environment)||
   !session(response.id)||!response.id.startsWith('cs_'+environment+'_')||
   response.object!=='checkout.session'||response.mode!=='payment'||
   response.client_reference_id!==order.id||
   response.metadata?.orgaiz_order_id!==order.id||
   response.payment_status==='paid'||typeof response.url!=='string')deny();
 let u;try{u=new URL(response.url)}catch{deny()}
 if(u.protocol!=='https:'||u.hostname!=='checkout.stripe.com'||
   u.username||u.password||u.port||u.hash||!u.pathname.startsWith('/c/'))deny();
 return Object.freeze({
  provider:'stripe',providerSessionId:response.id,orderId:order.id,
  checkoutUrl:u.href,paymentVerified:false
 });
}
