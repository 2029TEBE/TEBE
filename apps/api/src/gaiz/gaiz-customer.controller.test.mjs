// Isolated controller test harness. No DB, network or Nest app boot required.
// Uses TypeScript transpilation available from the backend devDependencies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(join(dirname(fileURLToPath(import.meta.url)),'gaiz-customer.controller.ts'),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  experimentalDecorators:true,emitDecoratorMetadata:false
}}).outputText;
const decorator=()=>()=>{};
class UnauthorizedException extends Error{}
class ForbiddenException extends Error{}
class NotFoundException extends Error{}
let context;
const fakeRequire=name=>{
  if(name==='@nestjs/common')return {Controller:decorator,Get:decorator,Req:decorator,Res:decorator,NotFoundException,ForbiddenException,UnauthorizedException};
  if(name==='@nestjs/throttler')return {Throttle:decorator};
  if(name==='../auth/auth.service')return {SESSION_COOKIE:'pmo_session'};
  if(name==='../tenancy/tenant-context')return {currentContext:()=>context};
  throw Error('Unexpected dependency: '+name);
};
const mod={exports:{}};
vm.runInNewContext('(function(require,module,exports,process){'+output+'\n})',
  {Error,Object,Reflect,Promise}).call(null,fakeRequire,mod,mod.exports,process);
const Controller=mod.exports.GaizCustomerController;
const principal={userId:'user-a',tenantId:'tenant-a',role:'owner'};
const make=(authResult=principal)=>({
  controller:new Controller({principal:async()=>authResult}),
  req:{cookies:{pmo_session:'synthetic-session-token'}},
  res:{headers:{},setHeader(name,value){this.headers[name]=value}}
});
test('disabled-by-default GAIZ customer endpoint is unavailable',async()=>{
 const previous=process.env.GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED;
 delete process.env.GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED;
 try{const x=make();context={userId:'user-a',tenantId:'tenant-a'};
 await assert.rejects(x.controller.session(x.req,x.res),NotFoundException);
 assert.equal(x.res.headers['Cache-Control'],'private, no-store')}
 finally{if(previous===undefined)delete process.env.GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED;else process.env.GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED=previous}
});
test('enabled endpoint accepts only real matching signed-in session and active tenant',async()=>{
 const previous=process.env.GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED;
 process.env.GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED='true';
 try{
 context={userId:'user-a',tenantId:'tenant-a'};
 const x=make();const receipt=await x.controller.session(x.req,x.res);
 assert.equal(receipt.authenticated,true);
 assert.equal(receipt.tenantBound,true);
 assert.equal(receipt.identityProvider,'epmo-session');
 assert.equal(receipt.gaizEntitled,false);
 assert.equal(receipt.gaizDownloadAuthorized,false);
 assert.equal(receipt.gaizImportAuthorized,false);
 assert.equal(receipt.gaizIssuerVerified,false);
 assert.equal(receipt.tenantId,'tenant-a');
 const noCookie=make();delete noCookie.req.cookies.pmo_session;
 await assert.rejects(noCookie.controller.session(noCookie.req,noCookie.res),UnauthorizedException);
 await assert.rejects(make(null).controller.session(make(null).req,make(null).res),UnauthorizedException);
 context={userId:'user-a',tenantId:'another-tenant'};
 await assert.rejects(make().controller.session(make().req,make().res),ForbiddenException);
 context={userId:'someone-else',tenantId:'tenant-a'};
 await assert.rejects(make().controller.session(make().req,make().res),ForbiddenException);
 }finally{if(previous===undefined)delete process.env.GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED;else process.env.GAIZ_CUSTOMER_SESSION_PREFLIGHT_ENABLED=previous}
});
