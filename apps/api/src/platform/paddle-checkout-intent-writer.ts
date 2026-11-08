/**
 * CI-disposable Paddle checkout transaction binding writer.
 * No NestJS registration, public route, payment or entitlement activation.
 * Only call after the existing sandbox transport validates the provider response.
 */
import { sql } from 'drizzle-orm';
import { withTenantSerializable } from '@pmo/db';
import { ensureDisposableWriter } from './paddle-ledger-writer';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TXN=/^txn_[a-z0-9]{26}$/;
const PRICE='pri_01m6x7w5zy16nktzjwg2ezas2d';
const PRODUCT='pro_01m6x789k8kmvez6zk7cm17wdz';
const rows=(value:unknown)=>value as Array<Record<string,any>>;
const refuse=(why:string):never=>{throw new Error('Paddle checkout binding refused: '+why);};

type Input={
 source:'locked-tenant-record'; provider:'paddle'; environment:'sandbox';
 tenantId:string; intentId:string; invoiceId:string;
 subscriptionId:string; planId:string; expiresAt:number;
 transactionId:string; verifiedPriceId:string; verifiedProductId:string;
 transportValidated:true; requiresAtomicTenantPersistence:true;
};

export async function persistDisposablePaddleCheckout(input:Input):Promise<{
 persisted:true; intentId:string; transactionId:string;
 checkoutAllowed:false; entitlementGranted:false;
}> {
 ensureDisposableWriter(process.env);
 if(!input||input.source!=='locked-tenant-record'||
   input.provider!=='paddle'||input.environment!=='sandbox'||
   ![input.tenantId,input.intentId,input.invoiceId,input.subscriptionId,input.planId]
      .every(x=>typeof x==='string'&&UUID.test(x))||
   !TXN.test(input.transactionId||'')||
   input.verifiedPriceId!==PRICE||input.verifiedProductId!==PRODUCT||
   input.transportValidated!==true||
   input.requiresAtomicTenantPersistence!==true||
   !Number.isSafeInteger(input.expiresAt)||
   input.expiresAt<=Date.now()||
   input.expiresAt>Date.now()+15*60*1000)
   refuse('untrusted_provider_transaction_or_intent');
 const tenant=input.tenantId;
 return withTenantSerializable(tenant,async tx=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(1212,hashtext(${tenant}))`);
   const invoice=rows(await tx.execute(sql`
     SELECT i.id AS "invoiceId",i.status AS "invoiceStatus",
       i.amount_minor AS "amountMinor",i.currency,
       i.subscription_id AS "invoiceSubscriptionId",
       s.id AS "subscriptionId",s.plan_id AS "planId",
       s.status AS "subscriptionStatus",
       s.cancel_at_period_end AS "cancelAtPeriodEnd",
       p.price_minor AS "planAmountMinor",
       p.currency AS "planCurrency",p.billing_interval AS "billingInterval"
     FROM billing_invoices i
     JOIN tenant_subscriptions s ON
       s.tenant_id=i.tenant_id AND s.id=i.subscription_id
     JOIN subscription_plans p ON p.id=s.plan_id
     WHERE i.tenant_id=${tenant} AND i.id=${input.invoiceId}
     FOR UPDATE OF i,s`))[0];
   if(!invoice||invoice.invoiceId!==input.invoiceId||
     invoice.invoiceStatus!=='open'||
     invoice.invoiceSubscriptionId!==input.subscriptionId||
     invoice.subscriptionId!==input.subscriptionId||
     invoice.planId!==input.planId||
     invoice.amountMinor!==4900||invoice.currency!=='USD'||
     invoice.planAmountMinor!==4900||invoice.planCurrency!=='USD'||
     invoice.billingInterval!=='monthly'||
     !['active','trialing','past_due'].includes(invoice.subscriptionStatus)||
     invoice.cancelAtPeriodEnd===true)
     refuse('untrusted_invoice_or_subscription_terms');

   const duplicate=rows(await tx.execute(sql`
     SELECT id FROM billing_paddle_checkout_intents
     WHERE tenant_id=${tenant} AND
       (id=${input.intentId} OR invoice_id=${input.invoiceId}
        OR paddle_transaction_id=${input.transactionId})
     LIMIT 1`));
   if(duplicate.length) refuse('existing_checkout_requires_reconciliation');

   const inserted=rows(await tx.execute(sql`
     INSERT INTO billing_paddle_checkout_intents
       (id,tenant_id,subscription_id,plan_id,invoice_id,
        paddle_transaction_id,paddle_price_id,environment,expires_at)
     VALUES (${input.intentId},${tenant},${input.subscriptionId},
       ${input.planId},${input.invoiceId},${input.transactionId},
       ${PRICE},'sandbox',${new Date(input.expiresAt).toISOString()}::timestamptz)
     RETURNING id`))[0];
   if(inserted?.id!==input.intentId) refuse('checkout_intent_not_persisted');
   return {persisted:true as const,intentId:input.intentId,
     transactionId:input.transactionId,checkoutAllowed:false as const,
     entitlementGranted:false as const};
 });
}
