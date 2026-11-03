import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTestCheckoutRedirects} from './commercial-checkout-redirects.mjs';
const valid={trustedOrigin:'https://app.example.test',allowedOrigins:['https://app.example.test'],deployment:'shared_saas',mode:'test',tenantId:'tenant_1'};
test('builds fixed success/cancel URLs with Stripe session placeholder',()=>{
 const v=buildTestCheckoutRedirects(valid);
 assert.equal(v.successUrl,'https://app.example.test/billing/checkout/success?tenant=tenant_1&session_id={CHECKOUT_SESSION_ID}');
 assert.equal(v.cancelUrl,'https://app.example.test/billing/checkout/cancel?tenant=tenant_1');
});
for(const [name,patch] of [
 ['live mode',{mode:'live'}],['dedicated',{deployment:'dedicated_enterprise'}],
 ['government',{deployment:'government'}],['unknown origin',{trustedOrigin:'https://evil.example'}],
 ['scheme downgrade',{trustedOrigin:'http://app.example.test',allowedOrigins:['http://app.example.test']}],
 ['embedded credentials',{trustedOrigin:'https://a:b@app.example.test'}],
 ['path injection',{trustedOrigin:'https://app.example.test/redirect'}],
 ['query injection',{trustedOrigin:'https://app.example.test?next=evil'}],
 ['fragment injection',{trustedOrigin:'https://app.example.test#x'}],
 ['tenant query injection',{tenantId:'x&redirect=evil'}],
 ['missing allowlist',{allowedOrigins:[]}],
 ['wildcard allowlist',{allowedOrigins:['https://*.example.test']}],
]) test('rejects '+name,()=>assert.throws(()=>buildTestCheckoutRedirects({...valid,...patch})));
test('permits explicit loopback for disposable TEST environment',()=>{
 const v=buildTestCheckoutRedirects({...valid,trustedOrigin:'http://localhost:3000',allowedOrigins:['http://localhost:3000']});
 assert.match(v.successUrl,/^http:\/\/localhost:3000\/billing\/checkout\/success/);
});
