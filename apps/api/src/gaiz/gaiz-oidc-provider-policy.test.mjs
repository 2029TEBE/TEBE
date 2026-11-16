import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOrgaizProviderOnboarding} from './gaiz-oidc-provider-policy.mjs';
const approval={
 status:'approved',issuer:'https://identity.example.test',
 clientId:'orgaiz-standalone',redirectUri:'https://orgaiz.example.test/auth/callback',
 reviewId:'security-review-001',approvedBy:'synthetic-reviewer',
 allowedJwksUri:'https://identity.example.test/keys'
};
const metadata={
 issuer:approval.issuer,authorization_endpoint:'https://identity.example.test/authorize',
 token_endpoint:'https://identity.example.test/token',jwks_uri:approval.allowedJwksUri,
 response_types_supported:['code'],grant_types_supported:['authorization_code'],
 code_challenge_methods_supported:['S256'],id_token_signing_alg_values_supported:['RS256','EdDSA'],
 token_endpoint_auth_methods_supported:['private_key_jwt','client_secret_basic']
};
test('reviewed provider metadata results in a non-active PKCE configuration',()=>{
 const v=validateOrgaizProviderOnboarding({approval,metadata});
 assert.equal(v.status,'reviewed-not-active');
 assert.equal(v.issuer,approval.issuer);
 assert.equal(v.pkceMethod,'S256');
 assert.equal(v.tokenEndpoint,metadata.token_endpoint);
 assert.ok(Object.isFrozen(v));
});
test('missing independent approval or untrusted metadata fails closed',()=>{
 for(const changed of [{...approval,status:'draft'},{...approval,reviewId:''},
   {...approval,issuer:'http://identity.example.test'},
   {...approval,allowedJwksUri:'https://another.example.test/keys'},
   {...approval,redirectUri:'http://localhost:3000/callback'}]){
   assert.throws(()=>validateOrgaizProviderOnboarding({approval:changed,metadata}));
 }
 assert.throws(()=>validateOrgaizProviderOnboarding({approval,metadata:{...metadata,jwks_uri:'https://evil.example.test/key'}}));
 assert.throws(()=>validateOrgaizProviderOnboarding({approval,metadata:{...metadata,authorization_endpoint:'http://identity.example.test/authorize'}}));
 assert.throws(()=>validateOrgaizProviderOnboarding({approval,metadata:{...metadata,token_endpoint:'https://token.evil.example.test/token'}}));
});
test('requires code flow, S256 PKCE and supported signature algorithms',()=>{
 for(const changes of [
 {response_types_supported:['id_token']},
 {code_challenge_methods_supported:['plain']},
 {id_token_signing_alg_values_supported:['none']},
 {grant_types_supported:['implicit']}
 ])assert.throws(()=>validateOrgaizProviderOnboarding({approval,metadata:{...metadata,...changes}}));
});
test('does not allow token or browser supplied metadata override',()=>{
 assert.throws(()=>validateOrgaizProviderOnboarding({approval,metadata:{...metadata,jwks_uri:'https://identity.example.test/keys',jku:'https://untrusted.test'}}));
 assert.throws(()=>validateOrgaizProviderOnboarding({approval:{...approval,unreviewed:true},metadata}));
});
