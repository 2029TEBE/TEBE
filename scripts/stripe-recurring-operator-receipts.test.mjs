import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_SCENARIOS, validateStripeOperatorReceipts } from './stripe-recurring-operator-receipts.mjs';
const sha = 'a'.repeat(40), digest = char => char.repeat(64);
const tenants = { a:'c47bf504-3bb0-4f81-9143-a155c0e1a117', b:'c250de9d-a7bf-42fb-9d9e-113f303e1ef6' };
const time = Date.parse('2026-11-01T10:00:00Z');
const proof = {
  first_customer_subscription_checkout: { checkoutMode:'subscription',checkoutSessionId:'cs_test_Example123',stripeSubscriptionId:'sub_Example123',providerLivemode:false,tenantBound:true,priceServerOwned:true,providerReadback:true },
  webhook_signature_verified: { rawBodyUsed:true,validSignatureAccepted:true,tamperedSignatureRejected:true,unsignedRejected:true,providerEventMatched:true },
  webhook_replay_idempotent: { receiptCountBefore:1,receiptCountAfter:1,ledgerCountBefore:1,ledgerCountAfter:1,entitlementUnchanged:true,sameEventDigest:true },
  entitlement_activation: { paymentLedgerRows:1,entitlementActive:true,providerInvoicePaid:true,tenantBound:true,noRedirectOnlyGrant:true },
  failed_payment_access_policy: { failureStatus:'past_due',noNewGrant:true,unexpiredAccessPreserved:true,expiredAccessDenied:true,providerFailureMatched:true },
  subscription_cancellation: { providerCanceled:true,entitlementRevoked:true,replayNoRegrant:true,tenantBound:true },
  cross_tenant_billing_isolation: { tenantA:tenants.a,tenantB:tenants.b,foreignReadDenied:true,foreignWriteDenied:true,crossTenantReplayDenied:true,restrictedRlsRole:true },
};
function fixture() {
  const scenarios = {};
  REQUIRED_SCENARIOS.forEach((name,i) => { scenarios[name] = {
    status:'PASS',testResult:'passed',commitSha:sha,stripeMode:'test',
    executedAtUtc:'2026-11-01T09:50:00Z',
    artifactUrl:'https://github.com/faisalwrokksa-hub/THEEPMOTEST/actions/runs/41294792139',
    eventIdSha256:digest(String((i===2?2:i+1)%10)),
    proof:structuredClone(proof[name]),
  }; });
  return { candidateSha:sha,environment:'staging',stripeMode:'test',providerReceipts:'real-test-only',
    reviewer:'Independent QA',tenants,scenarios };
}
const validate = bundle => validateStripeOperatorReceipts(bundle,time);
test('synthetic schema fixture is review-only, NEVER real provider acceptance',()=>{
  const result = validate(fixture());
  assert.equal(result.operatorClaimsValidated,7);
  assert.equal(result.providerIndependentlyVerified,false);
  assert.equal(result.releaseAccepted,false);
  assert.equal(result.decision,'NO-GO');
});
test('rejects missing scenarios, cross-SHA receipts and live mode',()=>{
  const a=fixture();delete a.scenarios.subscription_cancellation;
  assert.throws(()=>validate(a),/Exactly seven/);
  const b=fixture();b.scenarios.entitlement_activation.commitSha='b'.repeat(40);
  assert.throws(()=>validate(b),/same-SHA/);
  const c=fixture();c.stripeMode='live';
  assert.throws(()=>validate(c),/TEST staging/);
});
test('rejects secrets, cookies, personal data and URL query tokens',()=>{
  for (const field of ['sk_test_abc','whsec_abc','pmo_session=abc','person@example.com']) {
    const b=fixture();b.extra=field;assert.throws(()=>validate(b),/Sensitive/);
  }
  const b=fixture();b.scenarios.webhook_signature_verified.artifactUrl += '?token=abc';
  assert.throws(()=>validate(b),/credential-free/);
});
test('rejects stale, future and invalid receipt timestamps',()=>{
  for (const stamp of ['2026-10-20T09:00:00Z','2026-11-01T10:01:00Z','not-a-date']) {
    const b=fixture();b.scenarios.subscription_cancellation.executedAtUtc=stamp;
    assert.throws(()=>validate(b),/timestamp/);
  }
});
test('requires negative signature and tenant-bound webhook proof',()=>{
  const a=fixture();a.scenarios.webhook_signature_verified.proof.tamperedSignatureRejected=false;
  assert.throws(()=>validate(a),/tamperedSignatureRejected/);
  const b=fixture();b.scenarios.cross_tenant_billing_isolation.proof.foreignWriteDenied=false;
  assert.throws(()=>validate(b),/foreignWriteDenied/);
});
test('requires one ledger settlement and no replay entitlement changes',()=>{
  const a=fixture();a.scenarios.webhook_replay_idempotent.proof.ledgerCountAfter=2;
  assert.throws(()=>validate(a),/one receipt/);
  const b=fixture();b.scenarios.entitlement_activation.proof.paymentLedgerRows=2;
  assert.throws(()=>validate(b),/exactly one/);
});
test('requires actual subscription checkout, failed-payment and cancellation policy',()=>{
  const a=fixture();a.scenarios.first_customer_subscription_checkout.proof.checkoutMode='payment';
  assert.throws(()=>validate(a),/subscription-mode/);
  const b=fixture();b.scenarios.failed_payment_access_policy.proof.expiredAccessDenied=false;
  assert.throws(()=>validate(b),/expiredAccessDenied/);
  const c=fixture();c.scenarios.subscription_cancellation.proof.replayNoRegrant=false;
  assert.throws(()=>validate(c),/replayNoRegrant/);
});
test('rejects tenant reuse and mismatched replay event identity',()=>{
  const a=fixture();a.tenants.b=a.tenants.a;
  assert.throws(()=>validate(a),/distinct/);
  const b=fixture();b.scenarios.webhook_replay_idempotent.eventIdSha256=digest('9');
  assert.throws(()=>validate(b),/same signed webhook/);
});
