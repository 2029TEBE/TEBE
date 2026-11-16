import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateTebeCustody} from './gaiz-custody-policy.mjs';
const now=Date.parse('2026-11-16T12:00:00.000Z');
const context={tenantId:'tenant-a',userId:'user-admin',capabilities:['pmoa_admin']};
const request={id:'review-01',tenantId:'tenant-a',requestedBy:'user-requester',
 reviewedBy:'user-reviewer',status:'approved',sha256:'a'.repeat(64),
 artifactId:'synthetic-01',issuerId:'issuer-01',expiresAt:'2026-11-17T00:00:00.000Z'};
const verification={verified:true,tenantScope:'tenant-a',sha256:request.sha256,
 artifactId:request.artifactId,issuerId:request.issuerId};
const recipient={tenantScope:'tenant-a',keyId:'key-01',status:'active',
 algorithm:'RSA-OAEP-SHA256',ownerType:'customer',
 activeFrom:'2026-01-01T00:00:00.000Z',activeUntil:'2027-01-01T00:00:00.000Z'};
const args={context,request,verification,recipient,now};
test('TEBE custody eligibility cannot decrypt or authorize imports',()=>{
 const r=evaluateTebeCustody(args);
 assert.equal(r.status,'awaiting-external-custodian');
 assert.equal(r.decryptAllowed,false);assert.equal(r.importAllowed,false);
 assert.equal(r.plaintextReleased,false);
});
test('cross-tenant, self-review, expiry, revoked recipient and forged receipt fail',()=>{
 for(const o of [
  {context:{...context,tenantId:'other'}},
  {context:{...context,capabilities:[]}},
  {request:{...request,reviewedBy:'user-requester'}},
  {request:{...request,expiresAt:'2025-01-01T00:00:00.000Z'}},
  {recipient:{...recipient,status:'revoked'}},
  {recipient:{...recipient,tenantScope:'other'}},
  {verification:{...verification,sha256:'b'.repeat(64)}},
  {verification:{...verification,verified:false}},
  {recipient:{...recipient,ownerType:'platform'}}
 ])assert.throws(()=>evaluateTebeCustody({...args,...o}));
});
test('platform recovery requires independently approved matching customer consent',()=>{
 const platform={...recipient,ownerType:'platform'};
 const consent={consentId:'consent-01',tenantId:'tenant-a',keyId:'key-01',
 status:'approved',expiresAt:'2026-11-17T00:00:00.000Z'};
 assert.equal(evaluateTebeCustody({...args,recipient:platform,consent}).decryptAllowed,false);
 assert.throws(()=>evaluateTebeCustody({...args,recipient:platform,consent:{...consent,status:'revoked'}}));
});
