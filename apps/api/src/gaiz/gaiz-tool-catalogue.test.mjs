import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizToolCatalogue} from './gaiz-tool-catalogue.mjs';
const item={toolId:'executive-summary',productId:'product-1',title:'Executive summary',
 formats:['pdf','html'],maxInputsBytes:2048,workerKey:'approved-summary-worker',active:true};
const catalogue=()=>createGaizToolCatalogue({serverTools:[item],allowedWorkerKeys:['approved-summary-worker']});
const session={authenticated:true,identityProvider:'oidc',customerId:'customer-a',epmoTenantBound:false};
const request={toolId:item.toolId,format:'pdf',inputs:{subject:'Synthetic topic only'}};
const serverProduct={productId:item.productId,priceMinor:1900,currency:'USD',active:true};
const policy={canRequestReport:true};
test('only allowlisted tools are listed; worker and price remain private',()=>{
 const t=catalogue(),list=t.publicList();
 assert.deepEqual(list,[{toolId:'executive-summary',title:'Executive summary',formats:['pdf','html']}]);
 assert.equal(JSON.stringify(list).includes('workerKey'),false);
 const result=t.requireRequest({request,serverProduct,session,serverPolicy:policy});
 assert.equal(result.priceMinor,1900);
 assert.equal(result.customerId,'customer-a');
});
test('unauthenticated customers, spoofed pricing and unsupported formats fail',()=>{
 const t=catalogue();
 const opts={request,serverProduct,session,serverPolicy:policy};
 for(const alt of [
  {...opts,session:{...session,authenticated:false}},
  {...opts,session:{...session,identityProvider:'epmo-session'}},
  {...opts,serverProduct:{...serverProduct,productId:'wrong'}},
  {...opts,serverProduct:{...serverProduct,active:false}},
  {...opts,request:{...request,format:'gaiz'}},
  {...opts,request:{...request,priceMinor:1}},
  {...opts,serverPolicy:{canRequestReport:false}}
 ])assert.throws(()=>t.requireRequest(alt));
});
test('reject arbitrary workers, duplicate catalogue entries and oversized inputs',()=>{
 assert.throws(()=>createGaizToolCatalogue({serverTools:[item],allowedWorkerKeys:[]}));
 assert.throws(()=>createGaizToolCatalogue({serverTools:[item,item],allowedWorkerKeys:[item.workerKey]}));
 assert.throws(()=>catalogue().requireRequest({
  request:{...request,inputs:{subject:'a'.repeat(3000)}},serverProduct,session,serverPolicy:policy
 }));
});
