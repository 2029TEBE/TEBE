import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizReviewedCodeBroker} from './gaiz-reviewed-code-broker.mjs';
const issuer='https://id.example.test/';
const approval={
 status:'approved',issuer,clientId:'orgaiz-client',
 redirectUri:'https://orgaiz.example.test/auth/callback',
 reviewId:'synthetic-review-1',approvedBy:'synthetic-reviewer',
 allowedJwksUri:'https://id.example.test/keys'
};
const metadata={
 issuer,authorization_endpoint:'https://id.example.test/authorize',
 token_endpoint:'https://id.example.test/oauth/token',jwks_uri:approval.allowedJwksUri,
 response_types_supported:['code'],grant_types_supported:['authorization_code'],
 code_challenge_methods_supported:['S256'],id_token_signing_alg_values_supported:['RS256'],
 token_endpoint_auth_methods_supported:['client_secret_basic']
};
const records=new Map();
const store={
 async put(k,v){records.set(k,v)},
 async take(k){const value=records.get(k);records.delete(k);return value}
};
test('disabled broker and wrong issuer configuration cannot initiate login',()=>{
 assert.throws(()=>createGaizReviewedCodeBroker({}));
 assert.throws(()=>createGaizReviewedCodeBroker({
  enabled:true,approval:{...approval,issuer:'https://bad.example.test/'},metadata,
  clientSecret:'synthetic-long-separate-secret-12345678',
  fetchImpl:async()=>{},store,issuerKeyProvider:async()=>[]
 }));
});
test('reviewed configuration creates S256 auth URL; malformed callback never exchanges',async()=>{
 let calls=0;
 const broker=createGaizReviewedCodeBroker({
  enabled:true,approval,metadata,
  clientSecret:'synthetic-long-separate-secret-12345678',
  fetchImpl:async()=>{calls++},
  store,issuerKeyProvider:async()=>[]
 });
 assert.equal(broker.providerStatus,'reviewed-not-active');
 const started=await broker.begin({sessionBinding:'synthetic-browser-binding-1234567890'});
 const url=new URL(started.authorizationUrl);
 assert.equal(url.origin,'https://id.example.test');
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(url.searchParams.get('client_id'),approval.clientId);
 await assert.rejects(broker.finish({
  state:url.searchParams.get('state'),code:'short',sessionBinding:'synthetic-browser-binding-1234567890'
 }));
 assert.equal(calls,0);
});
