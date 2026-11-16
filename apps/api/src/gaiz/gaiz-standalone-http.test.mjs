import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizStandaloneHttpBoundary} from './gaiz-standalone-http.mjs';

const origin='https://orgaiz.example.test';
const sessionToken='ogs1.'+'z'.repeat(43),state='s'.repeat(43),code='c'.repeat(43);
const validPrincipal={authenticated:true,customerId:'123e4567-e89b-42d3-a456-426614174000'};
const cookieName='__Host-orgaiz_session',loginName='__Host-orgaiz_login',csrfName='__Host-orgaiz_csrf';
function response(){
 const set=[],cleared=[],headers={};
 return {
  set,cleared,headers,
  setHeader(k,v){headers[k]=v},
  cookie(k,v,o){set.push({k,v,o})},
  clearCookie(k,o){cleared.push({k,o})},
  redirect(status,url){this.redirected={status,url}},
  json(v){this.body=v}
 };
}
function request({cookies={},query={},originHeader=origin,secure=true,host='orgaiz.example.test',
 csrfHeader}={}){
 return {secure,cookies,query,get(k){
  return {'origin':originHeader,'host':host,'x-orgaiz-csrf':csrfHeader}[k.toLowerCase()];
 }};
}
function handlers(){
 const calls=[];
 const broker={async begin({sessionBinding}){calls.push(['begin',sessionBinding]);
  return {authorizationUrl:'https://identity.example.test/authorize?state=safe',expiresAt:1800000000}}};
 const callback={async finishAndIssueCookieMaterial(args){calls.push(['callback',args]);
  return {token:sessionToken,expiresAt:Math.floor(Date.now()/1000)+3600}}};
 const service={
  async requireCustomer(token){calls.push(['require',token]);if(token!==sessionToken)throw Error('expired');return validPrincipal},
  async revoke(token){calls.push(['revoke',token])},
  async revokeAll(token){calls.push(['revokeAll',token])}
 };
 return {calls,h:createGaizStandaloneHttpBoundary({enabled:true,siteOrigin:origin,broker,callback,sessionService:service})};
}
test('disabled boundary denies all use without reviewed dependencies',()=>{
 assert.throws(()=>createGaizStandaloneHttpBoundary());
 assert.throws(()=>createGaizStandaloneHttpBoundary({enabled:true,siteOrigin:origin}));
});
test('OIDC begin sets host-only HttpOnly binding and uses 303',async()=>{
 const {h}=handlers(),res=response();
 await h.begin(request(),res);
 assert.equal(res.redirected.status,303);
 const item=res.set.find(x=>x.k===loginName);
 assert.ok(item);
 assert.equal(item.o.secure,true);
 assert.equal(item.o.httpOnly,true);
 assert.equal(item.o.sameSite,'lax');
 assert.equal(item.o.path,'/');
 assert.equal(res.headers['Cache-Control'],'no-store');
});
test('OIDC callback needs state, login binding, verified broker and secure cookie only',async()=>{
 const {h,calls}=handlers(),start=response();await h.begin(request(),start);
 const binding=start.set.find(x=>x.k===loginName).v;
 const res=response();
 await h.oidcCallback(request({cookies:{[loginName]:binding},query:{state,code},originHeader:undefined}),res);
 assert.equal(calls.filter(x=>x[0]==='callback').length,1);
 assert.equal(res.redirected.status,303);
 assert.equal(res.redirected.url,origin+'/account');
 const sessionCookie=res.set.find(x=>x.k===cookieName);
 assert.equal(sessionCookie.v,sessionToken);
 assert.equal(sessionCookie.o.httpOnly,true);
 assert.equal(sessionCookie.o.secure,true);
 assert.equal(sessionCookie.o.path,'/');
 assert.ok(res.set.find(x=>x.k===csrfName));
 assert.equal(res.cleared[0].k,loginName);
 assert.equal(JSON.stringify(res.body||{}).includes(sessionToken),false);
});
test('session status never leaks token or creates an EPMO membership',async()=>{
 const {h}=handlers(),res=response();
 await h.current(request({cookies:{[cookieName]:sessionToken}}),res);
 assert.equal(res.body.authenticated,true);
 assert.equal(res.body.gaizEntitled,false);
 assert.equal(res.body.gaizImportAuthorized,false);
 assert.equal(JSON.stringify(res.body).includes(sessionToken),false);
});
test('cross-origin and missing CSRF header prevent logout',async()=>{
 const {h,calls}=handlers();
 const token='q'.repeat(43),cs={[cookieName]:sessionToken,[csrfName]:token};
 await assert.rejects(h.logout(request({cookies:cs,originHeader:'https://attacker.example.test',csrfHeader:token}),response()));
 await assert.rejects(h.logout(request({cookies:cs}),response()));
 await assert.rejects(h.logout(request({cookies:cs,csrfHeader:token,secure:false}),response()));
 assert.equal(calls.some(x=>x[0]==='revoke'),false);
 const result=response();await h.logout(request({cookies:cs,csrfHeader:token}),result);
 assert.equal(result.body.ok,true);
 assert.equal(result.cleared.some(x=>x.k===cookieName),true);
});
test('logout all requires live session, original host and same-origin CSRF',async()=>{
 const {h,calls}=handlers();
 const token='q'.repeat(43),cs={[cookieName]:sessionToken,[csrfName]:token};
 await assert.rejects(h.logoutAll(request({cookies:cs,csrfHeader:token,host:'attacker.example.test'}),response()));
 const res=response();await h.logoutAll(request({cookies:cs,csrfHeader:token}),res);
 assert.equal(res.body.ok,true);
 assert.equal(calls.some(x=>x[0]==='revokeAll'),true);
});
