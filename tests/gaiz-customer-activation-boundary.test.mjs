// Release gate for GAIZ's source-only customer integration candidates.
// This does NOT claim the existing development-only GAIZ preview is unmounted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const app=read('apps/api/src/app.module.ts');
const gaiz=read('apps/api/src/gaiz/gaiz.module.ts');
const controller=read('apps/api/src/gaiz/gaiz.controller.ts');

test('customer GAIZ HTTP, OIDC and transactional handlers stay out of Nest registration',()=>{
 const registry=[app,gaiz].join('\n');
 const forbidden=[
   'gaiz-customer.module','gaiz-customer.controller',
   'gaiz-report-http','gaiz-customer-report-service',
   'gaiz-standalone-http','gaiz-standalone-login-broker',
   'gaiz-oidc-code-exchange','gaiz-atomic-customer-sessions',
   'gaiz-transactional-report-jobs','gaiz-postgres-worker-queue',
 ];
 for(const moduleName of forbidden){
   assert.equal(registry.includes(moduleName),false,
     'Customer GAIZ candidate has been registered without activation review: '+moduleName);
 }
});
test('existing preview controller is development-only and explicitly denies imports',()=>{
 assert.match(controller,/process\.env\.NODE_ENV\s*!==\s*'development'/);
 assert.match(controller,/process\.env\.GAIZ_PREVIEW_ENABLED\s*!==\s*'true'/);
 assert.match(controller,/verifyGaiz2ForPreview/);
 assert.match(controller,/importAllowed:\s*false/);
});
test('customer-facing recovery modules retain explicit inactive boundaries',()=>{
 const paths=[
  'gaiz-transactional-report-jobs.mjs',
  'gaiz-customer-report-service.mjs',
  'gaiz-report-http.mjs',
  'gaiz-oidc-code-exchange.mjs',
  'gaiz-atomic-customer-sessions.mjs'
 ];
 for(const name of paths){
  const source=read('apps/api/src/gaiz/'+name);
  assert.doesNotMatch(source,/@Controller\s*\(|@Module\s*\(/,
    name+' should not register an active NestJS module');
  assert.doesNotMatch(source,/from\s+['"]@nestjs\//,
    name+' should remain framework-unmounted');
 }
});
