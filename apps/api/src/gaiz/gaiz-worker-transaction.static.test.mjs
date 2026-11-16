import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(resolve(dir,path),'utf8');
const tx=read('gaiz-worker-transaction.ts');
const binder=read('gaiz-workload-binding.mjs');
const claim=read('gaiz-assignment-claim.ts');
const app=read('../app.module.ts');

test('worker transaction boundary verifies signed bytes rather than trusting a flag',()=>{
  assert.match(tx,/signedAssignment:string/);
  assert.match(tx,/trustedIssuerPublicKey:KeyObject/);
  assert.match(tx,/bindGaizWorkerIdentity\(signedAssignment,/);
  assert.match(binder,/verifyGaizWorkerAssignment\(encoded,/);
  assert.doesNotMatch(tx,/pool,workload,assignment,operation/);
});
test('signed assignment claim, business operation and tenant context share one transaction',()=>{
  assert.match(tx,/pool\.transaction\(async tx=>/);
  assert.match(tx,/set_config\('app.tenant_id'/);
  assert.match(tx,/await claimGaizWorkerAssignmentInTransaction\(tx,assignment/);
  assert.match(tx,/return operation\(tx,assignment\)/);
  assert.match(claim,/identity\.dbRole !== assignment\.purpose/);
  assert.match(claim,/ON CONFLICT \(assignment_id\) DO NOTHING/);
});
test('worker code remains disconnected, disabled in production and credential independent',()=>{
  assert.match(tx,/NODE_ENV==='production'/);
  assert.match(tx,/GAIZ_DEV_ONLY!=='true'/);
  assert.match(tx,/credentialExpiresAtMs/);
  assert.match(tx,/identitySource/);
  assert.doesNotMatch(app,/GaizWorkerTransaction|gaiz-worker-transaction/);
});
