import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareGaizQuarantine,checkGaizIntakeCollision} from './gaiz-intake.mjs';

const tenantId='00000000-0000-4000-8000-000000000001';
const actorId='00000000-0000-4000-8000-000000000002';
const policy={tenantId,actorId,idempotencyKey:'synthetic-request-0001'};
const artifact=()=>Buffer.from('GAIZ1\n{"candidate":"untrusted"}');

test('quarantine preparation retains only inert metadata and byte hash',()=>{
  const a=prepareGaizQuarantine(artifact(),policy);
  assert.equal(a.state,'quarantined');
  assert.equal(a.importAllowed,false);
  assert.equal(a.bytesLength,artifact().length);
  assert.match(a.envelopeSha256,/^[0-9a-f]{64}$/);
  assert.equal('bytes' in a,false);
  assert.equal('url' in a,false);
});
test('oversized, empty and wrong-prefix artifacts fail closed',()=>{
  assert.throws(()=>prepareGaizQuarantine(Buffer.alloc(8*1024*1024+1),policy));
  assert.throws(()=>prepareGaizQuarantine(Buffer.from('GAIZ1\n'),policy));
  assert.throws(()=>prepareGaizQuarantine(Buffer.from('PDF1\nxxx'),policy));
  assert.throws(()=>prepareGaizQuarantine('GAIZ1',policy));
  assert.throws(()=>prepareGaizQuarantine(artifact(),{...policy,idempotencyKey:'short'}));
});
test('duplicate request with same bytes is detectable; collision cannot overwrite',()=>{
  const first=prepareGaizQuarantine(artifact(),policy);
  const again=prepareGaizQuarantine(artifact(),policy);
  assert.equal(checkGaizIntakeCollision(first,again).jobId,first.jobId);
  assert.throws(()=>checkGaizIntakeCollision(first,prepareGaizQuarantine(
    Buffer.from('GAIZ1\n{"different":true}'),policy)));
  assert.throws(()=>checkGaizIntakeCollision(first,{...again,tenantId:actorId}));
});


test('GAIZ2 is not silently downgraded into the GAIZ1 quarantine candidate',()=>{
 assert.throws(()=>prepareGaizQuarantine(Buffer.from('GAIZ2\n{"candidate":"test"}'),policy),/rejected/);
});
test('missing tenant identity and mismatched idempotency replay are denied',()=>{
 assert.throws(()=>prepareGaizQuarantine(artifact(),{...policy,tenantId:undefined}),/rejected/);
 assert.throws(()=>prepareGaizQuarantine(artifact(),{...policy,actorId:'wrong'}),/rejected/);
 const initial=prepareGaizQuarantine(artifact(),policy);
 assert.equal(Object.isFrozen(initial),true);
 assert.throws(()=>checkGaizIntakeCollision(initial,{...initial,idempotencyKey:'synthetic-request-0002'}),/rejected/);
});
