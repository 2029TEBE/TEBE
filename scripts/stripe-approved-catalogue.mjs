/**
 * Stripe catalogue import preflight — validation and dry run only.
 * No Stripe API calls, no database writes, no prices guessed.
 * Input must be a separate, business-approved JSON manifest.
 *
 * Deliberately does not treat disposable seed plans as sellable offerings.
 */
const SAFE_ID=/^[a-z][a-z0-9_]{1,63}$/;
const CURRENCY=/^[a-z]{3}$/;
const PRICE=/^price_[A-Za-z0-9]+$/;
const allowKeys=(value,keys)=>{
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||
   Object.keys(value).some(k=>!keys.includes(k)))
  throw Error('Unexpected catalogue fields');
};
export function validateApprovedStripeCatalogue(manifest){
 allowKeys(manifest,['schemaVersion','approvedBy','approvedAt','taxPolicy','items']);
 if(manifest.schemaVersion!==1||typeof manifest.approvedBy!=='string'||
   manifest.approvedBy.trim().length<3||
   typeof manifest.approvedAt!=='string'||
   !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(manifest.approvedAt)||
   !Number.isFinite(Date.parse(manifest.approvedAt))||
   !Array.isArray(manifest.items)||manifest.items.length<1||manifest.items.length>40)
  throw Error('Catalogue approval metadata or items missing');
 allowKeys(manifest.taxPolicy,['collection','behavior','countryApproved']);
 if(!['none','manual','stripe_tax'].includes(manifest.taxPolicy.collection)||
    !['inclusive','exclusive'].includes(manifest.taxPolicy.behavior)||
    manifest.taxPolicy.countryApproved!==true)
  throw Error('Tax policy is not approved');
 const used=new Set();
 const items=manifest.items.map(item=>{
  allowKeys(item,['code','name','currency','unitAmountMinor','interval','stripePriceId']);
  if(typeof item.code!=='string'||!SAFE_ID.test(item.code)||
     typeof item.name!=='string'||item.name.trim().length<3||item.name.length>120||
     typeof item.currency!=='string'||!CURRENCY.test(item.currency)||
     !Number.isSafeInteger(item.unitAmountMinor)||item.unitAmountMinor<1||
     item.unitAmountMinor>100000000||
     !['month','year'].includes(item.interval)||
     (item.stripePriceId!==undefined&&
       (typeof item.stripePriceId!=='string'||!PRICE.test(item.stripePriceId))))
   throw Error('Invalid plan price');
  const key=item.code+'|'+item.interval+'|'+item.currency;
  if(used.has(key))throw Error('Duplicate plan interval and currency');
  used.add(key);
  return Object.freeze({...item});
 });
 return Object.freeze({
  kind:'approved-stripe-catalogue-dry-run',
  approvedBy:manifest.approvedBy,
  approvedAt:manifest.approvedAt,
  taxPolicy:Object.freeze({...manifest.taxPolicy}),
  items:Object.freeze(items),
  sandboxOnly:true,
  stripeApiCalls:0,
  databaseWrites:0,
  paymentCharges:0,
 });
}
