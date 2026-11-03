// Offline-only Servitro/Paddle deployment declaration gate. No network or credentials.
const SHA=/^[a-f0-9]{40}$/i;
const DIGEST=/^sha256:[a-f0-9]{64}$/i;
const HTTPS=/^https:\/\/[^/?#@\s]+(?:\/[^?#\s]*)?$/i;
const allowed=new Set(['releaseSha','imageDigest','environment','webOrigin','apiOrigin','mailTransport','billingProvider','paddleEnabled','stripeEnabled','paddleWebhookOrigin','paddleWebhookPath','paddleSecretSource','databaseMigrationMode','backup','rollback','health']);
function fail(code){return {ok:false,code,deploymentAuthorized:false,operationallyVerified:false};}
export function validateServitroPaddlePlan(plan){
 if(!plan||typeof plan!=='object'||Array.isArray(plan))return fail('invalid-plan');
 if(Object.keys(plan).some(k=>!allowed.has(k)))return fail('unexpected-field');
 if(!SHA.test(plan.releaseSha||'')||!DIGEST.test(plan.imageDigest||''))return fail('immutable-identity-required');
 if(plan.environment!=='isolated-nonproduction')return fail('nonproduction-required');
 if(!HTTPS.test(plan.webOrigin||'')||!HTTPS.test(plan.apiOrigin||''))return fail('https-origins-required');
 if(plan.billingProvider!=='paddle'||plan.stripeEnabled!==false||plan.paddleEnabled!==false)return fail('billing-must-remain-disabled');
 if(!['disabled','sandbox-only'].includes(plan.mailTransport))return fail('mail-mode-unsafe');
 if(!HTTPS.test(plan.paddleWebhookOrigin||'')||!/^\/[a-z0-9/_-]+$/i.test(plan.paddleWebhookPath||''))return fail('webhook-destination-invalid');
 if(plan.paddleWebhookOrigin!==plan.apiOrigin)return fail('webhook-api-origin-mismatch');
 if(!['managed-secret-reference','sealed-runtime-reference'].includes(plan.paddleSecretSource))return fail('secret-source-required');
 if(plan.databaseMigrationMode!=='expand-only')return fail('migration-mode-unsafe');
 const b=plan.backup,r=plan.rollback,h=plan.health;
 if(!b||b.encrypted!==true||b.offHost!==true||b.restoreTarget!=='isolated-nonproduction')return fail('recovery-plan-required');
 if(!r||r.imageDigest!==plan.imageDigest||r.manualApproval!==true||r.databaseRollback==='destructive')return fail('rollback-plan-unsafe');
 if(!h||!HTTPS.test(h.url||'')||!h.url.startsWith(plan.apiOrigin+'/')||h.tlsVerify!==true||h.networkProbeEnabled!==false)return fail('offline-health-plan-required');
 return {ok:true,code:'declaration-valid-only',deploymentAuthorized:false,operationallyVerified:false};
}
