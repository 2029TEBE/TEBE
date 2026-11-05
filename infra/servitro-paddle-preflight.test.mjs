import test from 'node:test';
import assert from 'node:assert/strict';
import {validateServitroPaddlePlan as validate} from './servitro-paddle-preflight.mjs';
const sha='a'.repeat(40), digest='sha256:'+'b'.repeat(64);
const valid=()=>({releaseSha:sha,imageDigest:digest,environment:'isolated-nonproduction',webOrigin:'https://staging.example.test',apiOrigin:'https://api.staging.example.test',mailTransport:'disabled',billingProvider:'paddle',paddleEnabled:false,stripeEnabled:false,paddleWebhookOrigin:'https://api.staging.example.test',paddleWebhookPath:'/billing/paddle/webhook',paddleSecretSource:'managed-secret-reference',databaseMigrationMode:'expand-only',backup:{encrypted:true,offHost:true,restoreTarget:'isolated-nonproduction'},rollback:{imageDigest:digest,manualApproval:true,databaseRollback:'none'},health:{url:'https://api.staging.example.test/health/ready',tlsVerify:true,networkProbeEnabled:false}});
test('valid declarations never authorize deployment',()=>assert.deepEqual(validate(valid()),{ok:true,code:'declaration-valid-only',deploymentAuthorized:false,operationallyVerified:false}));
for(const [name,mutate] of [
 ['active Paddle',p=>p.paddleEnabled=true],['active Stripe',p=>p.stripeEnabled=true],['live environment',p=>p.environment='production'],
 ['mutable image',p=>p.imageDigest='latest'],['bad sha',p=>p.releaseSha='main'],['insecure web',p=>p.webOrigin='http://example.test'],
 ['webhook mismatch',p=>p.paddleWebhookOrigin='https://other.example.test'],['webhook credentials',p=>p.paddleWebhookOrigin='https://user:pass@api.staging.example.test'],
 ['literal secret',p=>p.paddleSecretSource='secret-value'],['destructive migration',p=>p.databaseMigrationMode='drop-and-recreate'],
 ['unencrypted backup',p=>p.backup.encrypted=false],['same host backup',p=>p.backup.offHost=false],
 ['unsafe restore',p=>p.backup.restoreTarget='production'],['unapproved rollback',p=>p.rollback.manualApproval=false],
 ['wrong rollback digest',p=>p.rollback.imageDigest='sha256:'+'c'.repeat(64)],['network probing',p=>p.health.networkProbeEnabled=true],
 ['tls disabled',p=>p.health.tlsVerify=false],['unknown credential field',p=>p.paddleApiKey='secret'],
 ['live mail',p=>p.mailTransport='smtp-live']
])test(name,()=>{const p=valid();mutate(p);const r=validate(p);assert.equal(r.ok,false);assert.equal(r.deploymentAuthorized,false);assert.equal(r.operationallyVerified,false);});
