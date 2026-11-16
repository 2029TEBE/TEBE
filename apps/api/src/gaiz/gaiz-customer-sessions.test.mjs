import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizCustomerSessionService} from './gaiz-customer-sessions.mjs';
const customerId='123e4567-e89b-42d3-a456-426614174000';
const sid='b23e4567-e89b-42d3-a456-426614174000';
const identity={identityProvider:'oidc',issuer:'https://issuer.example.test/',subject:'subject-1',
  epmoTenantBound:false,gaizEntitled:false,gaizDownloadAuthorized:false,gaizImportAuthorized:false};
const now=1794830000;
function fixture(){
 const sessions=new Map(),events=[];
 let time=now,active=true;
 const adapter={
  async upsertCustomerByIdentity(k){events.push(['identity',k]);return active?{id:customerId,status:'active',...k}:{id:customerId,status:'suspended',...k}},
  async insertSession(s){events.push(['insert',s]);sessions.set(s.tokenDigest,{id:sid,customerId,issuer:identity.issuer,subject:identity.subject,customerStatus:'active',revokedAt:null,expiresAt:s.expiresAt});return {id:sid,customerId,expiresAt:s.expiresAt}},
  async readSessionWithCustomer(k){events.push(['read',k]);const x=sessions.get(k);return x&&{...x,customerStatus:active?'active':'suspended'}},
  async revokeSession(k,t){events.push(['revoke',k]);const x=sessions.get(k);if(x)x.revokedAt=t;},
  async revokeAllSessionsForCustomer(id,t){events.push(['revokeAll',id]);for(const s of sessions.values())if(s.customerId===id)s.revokedAt=t}
 };
 const service=createGaizCustomerSessionService({enabled:true,adapter,clock:()=>time,ttlSeconds:3600});
 return {service,events,sessions,advance:t=>time=t,suspend:()=>active=false};
}
test('disabled service refuses missing or untrusted database adapters',()=>{
 assert.throws(()=>createGaizCustomerSessionService());
 assert.throws(()=>createGaizCustomerSessionService({enabled:true,adapter:{}}));
});
test('requires independently verified callback, never grants purchase entitlements',async()=>{
 const f=fixture();
 await assert.rejects(f.service.issueFromTrustedCallback({identity}));
 const issued=await f.service.issueFromTrustedCallback({identity,callbackVerified:true});
 assert.match(issued.token,/^ogs1\.[A-Za-z0-9_-]{43}$/);
 assert.equal(issued.gaizEntitled,false);
 assert.equal(issued.gaizDownloadAuthorized,false);
 assert.equal(issued.gaizImportAuthorized,false);
 assert.equal(f.events[1][1].tokenDigest.includes(issued.token),false);
 const principal=await f.service.requireCustomer(issued.token);
 assert.equal(principal.customerId,customerId);assert.equal(principal.identityProvider,'oidc');
 assert.equal(principal.epmoTenantBound,false);assert.equal(principal.gaizImportAuthorized,false);
});
test('rejects expired, revoked, malformed and suspended sessions',async()=>{
 const f=fixture();const x=await f.service.issueFromTrustedCallback({identity,callbackVerified:true});
 await assert.rejects(f.service.requireCustomer('not-a-token'));
 await assert.rejects(f.service.requireCustomer('ogs1.'+'a'.repeat(43)));
 f.advance(now+3600);
 await assert.rejects(f.service.requireCustomer(x.token));
 const g=fixture(),y=await g.service.issueFromTrustedCallback({identity,callbackVerified:true});
 g.suspend();await assert.rejects(g.service.requireCustomer(y.token));
 const h=fixture(),z=await h.service.issueFromTrustedCallback({identity,callbackVerified:true});
 assert.deepEqual(await h.service.revoke(z.token),{revoked:true});
 await assert.rejects(h.service.requireCustomer(z.token));
});
test('revoke-all checks active token rather than trusting arbitrary customer ID',async()=>{
 const f=fixture(),x=await f.service.issueFromTrustedCallback({identity,callbackVerified:true});
 await assert.rejects(f.service.revokeAll({customerId}));
 assert.deepEqual(await f.service.revokeAll(x.token),{revoked:true});
 await assert.rejects(f.service.requireCustomer(x.token));
 assert.equal(f.events.some(([k])=>k==='revokeAll'),true);
});
test('rejects fake callbacks and wrong customer identity mapping',async()=>{
 const f=fixture();
 await assert.rejects(f.service.issueFromTrustedCallback({identity:{...identity,gaizEntitled:true},callbackVerified:true}));
 await assert.rejects(f.service.issueFromTrustedCallback({identity:{...identity,identityProvider:'epmo-session'},callbackVerified:true}));
});
