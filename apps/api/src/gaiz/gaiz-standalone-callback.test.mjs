import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizOidcSessionCallback} from './gaiz-standalone-callback.mjs';
const identity={identityProvider:'oidc',issuer:'https://issuer.example.test/',
 subject:'subject-1',epmoTenantBound:false,gaizEntitled:false,
 gaizDownloadAuthorized:false,gaizImportAuthorized:false};
test('OIDC callback verifies identity first and issues session as internal cookie material',async()=>{
 let seen;
 const adapter=createGaizOidcSessionCallback({
  broker:{finish:async args=>{seen=args;return identity}},
  sessionService:{issueFromTrustedCallback:async request=>{
   assert.equal(request.callbackVerified,true);
   assert.equal(request.identity,identity);
   return {token:'internal-only-opaque-token',expiresAt:1794833600}
  }}
 });
 const r=await adapter.finishAndIssueCookieMaterial({state:'state',code:'code',sessionBinding:'binding'});
 assert.equal(r.token,'internal-only-opaque-token');
 assert.deepEqual(seen,{state:'state',code:'code',sessionBinding:'binding'});
});
test('callback refuses EPMO membership, claimed entitlements and missing broker',async()=>{
 assert.throws(()=>createGaizOidcSessionCallback({}));
 for(const bad of [
  {...identity,identityProvider:'epmo-session'},
  {...identity,epmoTenantBound:true},
  {...identity,gaizEntitled:true},
  {...identity,gaizDownloadAuthorized:true},
  {...identity,gaizImportAuthorized:true}
 ]){
  let called=false;
  const adapter=createGaizOidcSessionCallback({
   broker:{finish:async()=>bad},
   sessionService:{issueFromTrustedCallback:async()=>{called=true;return {}}}
  });
  await assert.rejects(adapter.finishAndIssueCookieMaterial({}));
  assert.equal(called,false);
 }
});
test('failed state/PKCE or token verification never issues a session',async()=>{
 let called=false;
 const adapter=createGaizOidcSessionCallback({
  broker:{finish:async()=>{throw Error('Invalid state')}},
  sessionService:{issueFromTrustedCallback:async()=>{called=true;return {}}}
 });
 await assert.rejects(adapter.finishAndIssueCookieMaterial({}));
 assert.equal(called,false);
});
