// Server-managed GAIZ report catalogue and admission checks.
// No execution capability, dynamic code load or customer-supplied pricing.
import {parseGaizToolRequest} from './gaiz-service-contract.mjs';
const deny=()=>{throw Error('GAIZ report tool unavailable')};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const formats=new Set(['pdf','html','gaiz']);
function safeShape(tool){
 if(!tool||!id(tool.toolId)||!id(tool.productId)||
 typeof tool.title!=='string'||!tool.title.trim()||tool.title.length>120||
 !Array.isArray(tool.formats)||tool.formats.length<1||tool.formats.length>3||
 tool.formats.some(f=>!formats.has(f))||new Set(tool.formats).size!==tool.formats.length||
 !Number.isSafeInteger(tool.maxInputsBytes)||tool.maxInputsBytes<1||tool.maxInputsBytes>65536||
 tool.active!==true||!id(tool.workerKey))deny();
 return Object.freeze({toolId:tool.toolId,productId:tool.productId,
 title:tool.title,formats:Object.freeze([...tool.formats]),
 maxInputsBytes:tool.maxInputsBytes,workerKey:tool.workerKey});
}
export function createGaizToolCatalogue({serverTools=[],allowedWorkerKeys=[]}={}){
 if(!Array.isArray(serverTools)||serverTools.length>100||
 !Array.isArray(allowedWorkerKeys))deny();
 const keys=new Set(allowedWorkerKeys),registry=new Map();
 for(const candidate of serverTools){
  const tool=safeShape(candidate);
  if(!keys.has(tool.workerKey)||registry.has(tool.toolId))deny();
  registry.set(tool.toolId,tool);
 }
 return Object.freeze({
  publicList(){
   return Object.freeze([...registry.values()].map(t=>Object.freeze({
    toolId:t.toolId,title:t.title,formats:t.formats
   })));
  },
  requireRequest({request,serverProduct,session,serverPolicy}={}){
   if(!session||session.authenticated!==true||session.identityProvider!=='oidc'||
     !id(session.customerId)||session.epmoTenantBound!==false||
     !serverPolicy||serverPolicy.canRequestReport!==true)deny();
   const body=parseGaizToolRequest(request),tool=registry.get(body.toolId);
   if(!tool||!tool.formats.includes(body.format)||!serverProduct||
     serverProduct.productId!==tool.productId||
     !Number.isSafeInteger(serverProduct.priceMinor)||serverProduct.priceMinor<=0||
     !id(serverProduct.currency)||serverProduct.active!==true)deny();
   const inputBytes=Buffer.byteLength(JSON.stringify(body.inputs),'utf8');
   if(inputBytes>tool.maxInputsBytes)deny();
   // Price belongs exclusively to a trusted server-side product catalogue.
   // No customer-supplied amount, role, tenant, product or worker path accepted.
   return Object.freeze({
    customerId:session.customerId,toolId:tool.toolId,productId:tool.productId,
    format:body.format,inputs:body.inputs,workerKey:tool.workerKey,
    priceMinor:serverProduct.priceMinor,currency:serverProduct.currency
   });
  }
 });
}
