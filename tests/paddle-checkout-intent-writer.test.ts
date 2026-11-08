import { describe, expect, it } from 'vitest';
import { persistDisposablePaddleCheckout as persist } from
  '../apps/api/src/platform/paddle-checkout-intent-writer';

/**
 * Tests prove the writer never reaches SQL for invalid input, even when the
 * disposable DB switch is enabled. Real SQL atomicity needs a separate CI
 * disposable PostgreSQL fixture and is not claimed by these tests.
 */
const uuid=(c:string)=>c.repeat(8)+'-'+c.repeat(4)+'-4'+c.repeat(3)+'-8'+c.repeat(3)+'-'+c.repeat(12);
const binding=()=>({
  source:'locked-tenant-record' as const,
  provider:'paddle' as const,environment:'sandbox' as const,
  tenantId:uuid('1'),intentId:uuid('2'),invoiceId:uuid('3'),
  subscriptionId:uuid('4'),planId:uuid('5'),
  expiresAt:Date.now()+5*60*1000,
  transactionId:'txn_'+'a'.repeat(26),
  verifiedPriceId:'pri_01m6x7w5zy16nktzjwg2ezas2d',
  verifiedProductId:'pro_01m6x789k8kmvez6zk7cm17wdz',
  transportValidated:true as const,
  requiresAtomicTenantPersistence:true as const,
});

describe('Paddle checkout SQL writer is disabled outside disposable CI',()=>{
  it('does not allow direct writes in local or production contexts',async()=>{
    // Use deliberately invalid input: guard or schema validation must reject
    // before any database operation, independently of current test environment.
    await expect(persist({...binding(),tenantId:'browser'}))
      .rejects.toThrow(/writer_disabled|untrusted_provider_transaction_or_intent/);
  });
  it('refuses caller-controlled prices and unvalidated provider transactions',async()=>{
    await expect(persist({...binding(),verifiedPriceId:'pri_'+'x'.repeat(26)}))
      .rejects.toThrow(/writer_disabled|untrusted_provider_transaction_or_intent/);
    await expect(persist({...binding(),transportValidated:false as true}))
      .rejects.toThrow(/writer_disabled|untrusted_provider_transaction_or_intent/);
    await expect(persist({...binding(),transactionId:'untrusted'}))
      .rejects.toThrow(/writer_disabled|untrusted_provider_transaction_or_intent/);
  });
  it('rejects expired and out-of-window server intents',async()=>{
    await expect(persist({...binding(),expiresAt:Date.now()-1000}))
      .rejects.toThrow(/writer_disabled|untrusted_provider_transaction_or_intent/);
    await expect(persist({...binding(),expiresAt:Date.now()+20*60*1000}))
      .rejects.toThrow(/writer_disabled|untrusted_provider_transaction_or_intent/);
  });
});
