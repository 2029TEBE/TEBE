import test from 'node:test';
import assert from 'node:assert/strict';
import {ReadableStream} from 'node:stream/web';
import {createGaizOidcCodeExchange} from './gaiz-oidc-code-exchange.mjs';

const provider={
 status:'reviewed-not-active',clientId:'orgaiz-client',
 issuer:'https://id.example.test/',tokenEndpoint:'https://id.example.test/oauth/token',
 redirectUri:'https://orgaiz.example.test/auth/callback'
};
const secret='development-only-synthetic-client-secret';
const code='synthetic_authorization_code_123456';
const codeVerifier='v'.repeat(43);
const token=['a'.repeat(45),'b'.repeat(45),'c'.repeat(45)].join('.');
function response(data={id_token:token,token_type:'Bearer'},{
 status=200,contentType='application/json',chunks
}={}){
 const bytes=chunks||[new TextEncoder().encode(JSON.stringify(data))];
 const body=new ReadableStream({start(controller){for(const x of bytes)controller.enqueue(x);controller.close()}});
 return {status,ok:status>=200&&status<300,headers:{get:x=>
   x==='content-type'?contentType:x==='content-length'?null:null},body};
}
const req={code,codeVerifier,clientId:provider.clientId,redirectUri:provider.redirectUri};
test('disabled exchange refuses unapproved configuration or missing secrets',()=>{
 assert.throws(()=>createGaizOidcCodeExchange());
 assert.throws(()=>createGaizOidcCodeExchange({enabled:true,provider,fetchImpl:async()=>response()}));
 assert.throws(()=>createGaizOidcCodeExchange({enabled:true,provider:{...provider,tokenEndpoint:'http://id.example.test/oauth/token'},clientSecret:secret,fetchImpl:async()=>response()}));
});
test('server-to-server code redemption uses strict HTTPS PKCE and returns ID token only',async()=>{
 const calls=[];
 const exchange=createGaizOidcCodeExchange({enabled:true,provider,clientSecret:secret,
   fetchImpl:async(url,options)=>{calls.push([url,options]);return response({id_token:token,token_type:'Bearer',access_token:'private_access_token'})}});
 const result=await exchange(req);
 assert.deepEqual(result,{idToken:token});
 assert.equal(JSON.stringify(result).includes('private_access_token'),false);
 assert.equal(calls[0][0],provider.tokenEndpoint);
 assert.equal(calls[0][1].method,'POST');
 assert.equal(calls[0][1].redirect,'error');
 assert.equal(calls[0][1].credentials,'omit');
 assert.match(calls[0][1].headers.Authorization,/^Basic /);
 assert.equal(new URLSearchParams(calls[0][1].body).get('code_verifier'),codeVerifier);
 assert.equal(new URLSearchParams(calls[0][1].body).get('redirect_uri'),provider.redirectUri);
});
test('wrong client/redirect/PKCE/code never sends token request',async()=>{
 let count=0;
 const exchange=createGaizOidcCodeExchange({enabled:true,provider,clientSecret:secret,
  fetchImpl:async()=>{count++;return response()}});
 for(const changes of [
  {clientId:'other-client'}, {redirectUri:'https://attacker.example.test/callback'},
  {code:'short'}, {codeVerifier:'weak'}
 ])await assert.rejects(exchange({...req,...changes}));
 assert.equal(count,0);
});
test('refuses provider errors, unsafe content-type and forged bodies',async()=>{
 for(const result of [
  response({}, {status:400}),
  response({}, {contentType:'text/html'}),
  response({token_type:'Bearer'}),
  response({id_token:token,token_type:'not-bearer'}),
  response({id_token:'bad',token_type:'Bearer'}),
  response(undefined,{chunks:[new Uint8Array(32769)]})
 ]){
  const exchange=createGaizOidcCodeExchange({enabled:true,provider,clientSecret:secret,fetchImpl:async()=>result});
  await assert.rejects(exchange(req));
 }
});
