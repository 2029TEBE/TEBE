import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyStandaloneOidcIdentity} from './gaiz-standalone-oidc.mjs';
const issuer='https://identity.example.test', audience='orgaiz-broker',nonce='synthetic-browser-nonce';
const now=1794808800;
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const jwk={...publicKey.export({format:'jwk'}),kid:'fixture-key',alg:'EdDSA',use:'sig'};
const cfg={issuer,audience,expectedNonce:nonce,trustedJwks:[jwk],nowSeconds:now,maxAgeSeconds:600};
const claims={iss:issuer,aud:audience,sub:'synthetic-user-1',nonce,iat:now-60,auth_time:now-60,exp:now+300,email:'synthetic@example.test',email_verified:true};
const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const make=(payload=claims,head={typ:'JWT',kid:'fixture-key',alg:'EdDSA'})=>{
 const text=b(head)+'.'+b(payload);
 return text+'.'+sign(null,Buffer.from(text),privateKey).toString('base64url');
};
test('independently verified standalone identity is NOT EPMO tenant membership or a GAIZ entitlement',()=>{
 const r=verifyStandaloneOidcIdentity(make(),cfg);
 assert.equal(r.issuer,issuer);assert.equal(r.subject,'synthetic-user-1');
 assert.equal(r.identityProvider,'oidc');assert.equal(r.emailVerified,true);
 assert.equal(r.gaizEntitled,false);assert.equal(r.gaizDownloadAuthorized,false);
 assert.equal(r.gaizImportAuthorized,false);assert.equal(r.epmoTenantBound,false);
});
test('OIDC fails closed for wrong issuer, audience, nonce and invalid signature',()=>{
 for(const changes of [{iss:'https://attacker.example.test'},{aud:'another-client'},{nonce:'other'}, {exp:now-1},{auth_time:now-900}]){
  assert.throws(()=>verifyStandaloneOidcIdentity(make({...claims,...changes}),cfg));
 }
 const token=make().split('.');token[2]=token[2].slice(0,-1)+(token[2].endsWith('A')?'B':'A');
 assert.throws(()=>verifyStandaloneOidcIdentity(token.join('.'),cfg));
});
test('OIDC rejects token-supplied key URLs, no trust, ambiguous keys and wrong algorithms',()=>{
 assert.throws(()=>verifyStandaloneOidcIdentity(make(claims,{alg:'none',kid:'fixture-key'}),cfg));
 assert.throws(()=>verifyStandaloneOidcIdentity(make(claims,{alg:'EdDSA',kid:'fixture-key',jku:'https://attacker.test/jwks'}),cfg));
 assert.throws(()=>verifyStandaloneOidcIdentity(make(),{...cfg,trustedJwks:[]}));
 assert.throws(()=>verifyStandaloneOidcIdentity(make(),{...cfg,trustedJwks:[jwk,jwk]}));
});
test('unverified emails are not exported as identities',()=>{
 const result=verifyStandaloneOidcIdentity(make({...claims,email_verified:false}),cfg);
 assert.equal(result.emailVerified,false);assert.equal(Object.hasOwn(result,'email'),false);
});
