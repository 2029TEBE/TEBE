import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAuth0Candidate} from './gaiz-auth0-candidate.mjs';
const origin='https://synthetic-tenant.us.auth0.com';
const approval={
 provider:'auth0',activation:'disabled',issuer:origin+'/',
 reviewId:'fixture-review-001',approvedBy:'synthetic-reviewer',
 clientId:'synthetic-orgaiz-client',redirectUri:'https://orgaiz.example.test/auth/callback',
 allowedJwksUri:origin+'/.well-known/jwks.json'
};
const discovery={
 issuer:approval.issuer,authorization_endpoint:origin+'/authorize',
 token_endpoint:origin+'/oauth/token',jwks_uri:approval.allowedJwksUri,
 response_types_supported:['code'],grant_types_supported:['authorization_code'],
 code_challenge_methods_supported:['S256'],
 id_token_signing_alg_values_supported:['RS256'],
 token_endpoint_auth_methods_supported:['client_secret_basic','private_key_jwt'],
 userinfo_endpoint:origin+'/userinfo',claims_supported:['sub','email'],
 response_modes_supported:['query','form_post']
};
test('synthetic Auth0 OIDC discovery maps to reviewed, disabled provider configuration',()=>{
 const config=validateAuth0Candidate({approval,discovery});
 assert.equal(config.provider,'auth0');
 assert.equal(config.status,'candidate-reviewed-not-active');
 assert.equal(config.activation,'disabled');
 assert.equal(config.authorizationEndpoint,origin+'/authorize');
 assert.equal(config.tokenEndpoint,origin+'/oauth/token');
 assert.equal(config.jwksUri,approval.allowedJwksUri);
 assert.deepEqual(config.acceptedIdTokenAlgorithms,['RS256']);
});
test('unregistered or swapped tenant, endpoint and JWKS are rejected',()=>{
 for(const change of [
  {issuer:'https://evil.example.test/'},
  {issuer:'http://synthetic-tenant.us.auth0.com/'},
  {issuer:'https://auth0.com/'},
  {activation:'enabled'}
 ])assert.throws(()=>validateAuth0Candidate({approval:{...approval,...change},discovery}));
 for(const change of [
  {issuer:'https://another.us.auth0.com/'},
  {authorization_endpoint:'https://another.us.auth0.com/authorize'},
  {token_endpoint:'https://evil.example.test/oauth/token'},
  {jwks_uri:'https://evil.example.test/jwks.json'},
  {code_challenge_methods_supported:['plain']},
  {id_token_signing_alg_values_supported:['none']}
 ])assert.throws(()=>validateAuth0Candidate({approval,discovery:{...discovery,...change}}));
});
test('no operator approval or activated client is accepted',()=>{
 assert.throws(()=>validateAuth0Candidate({discovery}));
 assert.throws(()=>validateAuth0Candidate({approval:{...approval,reviewId:''},discovery}));
 assert.throws(()=>validateAuth0Candidate({approval:{...approval,provider:'other'},discovery}));
});
