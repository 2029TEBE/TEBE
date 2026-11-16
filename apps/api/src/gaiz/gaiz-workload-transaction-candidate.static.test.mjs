import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const here=new URL('./',import.meta.url);
const source=readFileSync(new URL('gaiz-workload-transaction-candidate.mjs',here),'utf8');
const helper=readFileSync(new URL('gaiz-workload-challenge-claim.mjs',here),'utf8');
const assignment=readFileSync(new URL('gaiz-assignment-claim.ts',here),'utf8');
const schema=readFileSync(new URL('../../../../packages/db/sql/gaiz-workload-challenge-review-proposal.sql',here),'utf8');
const position=phrase=>{const x=source.indexOf(phrase);assert.ok(x>=0,'missing '+phrase);return x;};

test('credential is verified before a single transaction consumes both replay claims',()=>{
 const verify=position('verifyGaizSignedWorkloadCredential(signedWorkloadCredential');
 const signedAssignment=position('bindGaizWorkerIdentity(signedAssignment');
 const transaction=position('pool.transaction(async tx=>');
 const tenant=position("set_config('app.tenant_id'");
 const challenge=position('await claimGaizWorkloadChallengeInTransaction(tx');
 const assignmentClaim=position('await claimAssignment(tx,assignment');
 const operation=position('return operation(tx,');
 assert.ok(verify<signedAssignment&&signedAssignment<transaction&&
           transaction<tenant&&tenant<challenge&&challenge<assignmentClaim&&
           assignmentClaim<operation);
});
test('separate database role and challenge digest are checked before returning a receipt',()=>{
 assert.match(helper,/current_user AS "dbRole"/);
 assert.match(helper,/found\[0\]\.dbRole!==purpose/);
 assert.match(helper,/found\[0\]\.currentTenant!==tenantId/);
 assert.match(helper,/createHash\('sha256'\)/);
 assert.match(helper,/consumed_at IS NULL/);
 assert.match(helper,/expires_at > clock_timestamp\(\)/);
 assert.match(assignment,/ON CONFLICT \(assignment_id\) DO NOTHING/);
 assert.match(source,/assignmentClaim\.assignmentId!==assignment\.assignmentId/);
});
test('database proposal requires force RLS and rejects interactive app writes',()=>{
 assert.match(schema,/ENABLE ROW LEVEL SECURITY/);
 assert.match(schema,/FORCE ROW LEVEL SECURITY/);
 assert.match(schema,/REVOKE ALL ON gaiz_workload_challenges FROM pmo_app/);
 assert.match(schema,/GRANT UPDATE\(consumed_at\)/);
 assert.match(schema,/CREATE POLICY gaiz_workload_challenge_worker_update/);
 assert.doesNotMatch(schema,/GRANT ALL ON gaiz_workload_challenges/);
});
test('production and incomplete provenance remain disconnected',()=>{
 assert.match(source,/process\.env\.NODE_ENV==='production'/);
 assert.match(source,/process\.env\.GAIZ_DEV_ONLY!=='true'/);
 assert.doesNotMatch(source,/issueChallengeProof|transportAuthenticated:true|authenticatedAssignment:true/);
 assert.doesNotMatch(source,/unwrapSyntheticRecipientDek|createDecipheriv/);
 assert.match(source,/importAllowed:false/);
});
