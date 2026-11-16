import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {createStandaloneLoginBroker} from './gaiz-standalone-login-broker.mjs';
const issuer='https://identity.example.test',clientId='orgaiz-client',now=1794808800;
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const jwk={...publicKey.export({format:'jwk'}),kid:'fixture-kid',alg:'EdDSA',use:'sig'};
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const signed=claims=>{const unsigned=enc({alg:'EdDSA',kid:'fixture-kid',typ:'JWT'})+'.'+enc(claims);return unsigned+'.'+sign(null,Buffer.from(unsigned),privateKey).toString('base64url')};
const fresh=()=>{
 const map=new Map(),calls=[];
 let current=now;
 const store={
  async put(key,value,ttl){assert.equal(ttl,600);assert.equal(map.has(key),false);map.set(key,value)},
  async take(key){const value=map.get(key);map.delete(key);return value}
 };
 const broker=createStandaloneLoginBroker({
  issuer,authorizationEndpoint:issuer+'/authorize',redirectUri:'https://orgaiz.example.test/callback',
  clientId,store,clock:()=>current,
  issuerKeyProvider:async()=>[jwk],
  exchangeCode:async o=>{
   calls.push(o);
   const state=map.size;
   return {idToken:signed({iss:issuer,aud:clientId,sub:'synthetic-account-01',nonce:lastNonce,
     exp:current+300,iat:current-30,auth_time:current-30})};
  }
 });
 let lastNonce;
 return {broker,calls,map,setNow:v=>current=v,setNonce:v=>lastNonce=v};
};
const binding='synthetic-browser-session-binding-1234567890';
test('authorization request uses code flow, S256 PKCE, nonce and no tokens in URL',async()=>{
 const x=fresh(),s=await x.broker.begin({sessionBinding:binding}),u=new URL(s.authorizationUrl);
 assert.equal(u.searchParams.get('response_type'),'code');
 assert.equal(u.searchParams.get('code_challenge_method'),'S256');
 assert.equal(u.searchParams.get('scope'),'openid');
 assert.equal(u.searchParams.get('client_id'),clientId);
 assert.ok(u.searchParams.get('nonce').length>=32);
 assert.ok(u.searchParams.get('state').length>=32);
 assert.ok(u.searchParams.get('code_challenge').length>=32);
 assert.equal(u.searchParams.has('id_token'),false);
 x.setNonce(u.searchParams.get('nonce'));
 const r=await x.broker.finish({state:u.searchParams.get('state'),code:'synthetic-authorization-code-123',sessionBinding:binding});
 assert.equal(r.subject,'synthetic-account-01');
 assert.equal(r.epmoTenantBound,false);assert.equal(r.gaizEntitled,false);
 assert.ok(x.calls[0].codeVerifier.length>=32);
 await assert.rejects(x.broker.finish({state:u.searchParams.get('state'),code:'synthetic-authorization-code-123',sessionBinding:binding}));
});
test('callback fails closed when session binding is wrong and cannot be replayed',async()=>{
 const x=fresh(),s=await x.broker.begin({sessionBinding:binding}),u=new URL(s.authorizationUrl);
 x.setNonce(u.searchParams.get('nonce'));
 await assert.rejects(x.broker.finish({state:u.searchParams.get('state'),code:'synthetic-authorization-code-123',sessionBinding:'wrong-browser-session-binding-123456'}));
 await assert.rejects(x.broker.finish({state:u.searchParams.get('state'),code:'synthetic-authorization-code-123',sessionBinding:binding}));
 assert.equal(x.calls.length,0);
});
test('callback rejects expired state before exchanging code',async()=>{
 const x=fresh(),s=await x.broker.begin({sessionBinding:binding}),u=new URL(s.authorizationUrl);
 x.setNow(now+601);
 await assert.rejects(x.broker.finish({state:u.searchParams.get('state'),code:'synthetic-authorization-code-123',sessionBinding:binding}));
 assert.equal(x.calls.length,0);
});
test('reject unapproved HTTP issuer and unconfigured broker dependencies',()=>{
 assert.throws(()=>createStandaloneLoginBroker({issuer:'http://localhost'}));
 assert.throws(()=>createStandaloneLoginBroker({issuer,authorizationEndpoint:issuer+'/auth',redirectUri:'https://orgaiz.example.test/callback',clientId}));
});
