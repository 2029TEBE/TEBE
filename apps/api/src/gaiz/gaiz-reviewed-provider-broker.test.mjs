import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewedStandaloneBroker} from './gaiz-reviewed-provider-broker.mjs';
const approval={
 status:'approved',issuer:'https://identity.example.test',clientId:'orgaiz-standalone',
 redirectUri:'https://orgaiz.example.test/auth/callback',
 reviewId:'security-review-001',approvedBy:'synthetic-reviewer',
 allowedJwksUri:'https://identity.example.test/keys'
};
const metadata={
 issuer:approval.issuer,authorization_endpoint:'https://identity.example.test/authorize',
 token_endpoint:'https://identity.example.test/token',jwks_uri:approval.allowedJwksUri,
 response_types_supported:['code'],grant_types_supported:['authorization_code'],
 code_challenge_methods_supported:['S256'],id_token_signing_alg_values_supported:['RS256']
};
const store={async put(){},async take(){return null}};
const exchangeCode=async()=>{throw Error('No live token endpoint configured')};
const issuerKeyProvider=async()=>[];
test('reviewed configuration binds offline authorization URL only',async()=>{
 const broker=createReviewedStandaloneBroker({approval,metadata,store,exchangeCode,issuerKeyProvider});
 assert.equal(broker.providerStatus,'reviewed-not-active');
 const started=await broker.begin({sessionBinding:'synthetic-browser-session-binding-12345678'});
 const url=new URL(started.authorizationUrl);
 assert.equal(url.origin,'https://identity.example.test');
 assert.equal(url.searchParams.get('response_type'),'code');
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(url.searchParams.get('client_id'),'orgaiz-standalone');
 assert.equal(url.searchParams.get('redirect_uri'),approval.redirectUri);
 assert.equal(broker.reviewId,'security-review-001');
});
test('unreviewed configuration and absent execution dependencies refuse activation',()=>{
 assert.throws(()=>createReviewedStandaloneBroker({approval:{...approval,status:'draft'},metadata,store,exchangeCode,issuerKeyProvider}));
 assert.throws(()=>createReviewedStandaloneBroker({approval,metadata}));
 assert.throws(()=>createReviewedStandaloneBroker({approval,metadata,store,exchangeCode}));
});
