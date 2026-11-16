// Proposal-level request/response validation. NOT a live GAIZ service or authorization policy.
export const GAIZ_SERVICE_CONTRACT='orgaiz.gaiz.jobs.v1-draft';
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const formats=new Set(['pdf','html','gaiz']);
const states=new Set(['queued','processing','completed','failed','expired','canceled']);
function fail(){throw Error('Invalid GAIZ service contract payload')}
export function parseGaizToolRequest(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='format,inputs,toolId')fail();
 if(!safeId(body.toolId)||!formats.has(body.format)||!body.inputs||typeof body.inputs!=='object'||Array.isArray(body.inputs))fail();
 if(Object.keys(body.inputs).length>32)fail();
 let text;try{text=JSON.stringify(body.inputs)}catch{fail()}
 if(!text||Buffer.byteLength(text,'utf8')>65536)fail();
 return Object.freeze({toolId:body.toolId,format:body.format,inputs:structuredClone(body.inputs)});
}
export function parseGaizJobResponse(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||!safeId(body.jobId)||!states.has(body.status))fail();
 if(body.status==='completed'&&!Array.isArray(body.outputs))fail();
 if(body.outputs!==undefined&&!Array.isArray(body.outputs))fail();
 const outputs=(body.outputs||[]).map(o=>{
  if(!o||typeof o!=='object'||!safeId(o.artifactId)||!formats.has(o.format))fail();
  return Object.freeze({artifactId:o.artifactId,format:o.format});
 });
 if(outputs.length>20)fail();
 return Object.freeze({jobId:body.jobId,status:body.status,outputs:Object.freeze(outputs)});
}
export function requireGaizServicePrincipal(ctx,{expectedTenantId}={}){
 // Must be called AFTER TEBE session validation, tenant middleware, and authorization.
 // This is a precondition check, NOT authorization or entitlement evaluation.
 if(!ctx||!safeId(ctx.userId)||!safeId(ctx.tenantId)||!safeId(expectedTenantId)||ctx.tenantId!==expectedTenantId)fail();
 return Object.freeze({userId:ctx.userId,tenantId:ctx.tenantId});
}
