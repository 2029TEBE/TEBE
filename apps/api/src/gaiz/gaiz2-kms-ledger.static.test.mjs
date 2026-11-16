import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../../../packages/db/sql/gaiz2-kms-release-claim-REVIEW-ONLY.sql',import.meta.url),'utf8');
const keyRegistry=readFileSync(new URL('../../../../packages/db/sql/gaiz2-recipient-key-registry-REVIEW-ONLY.sql',import.meta.url),'utf8');
test('release claims are tenant and grant unique, with no KMS or key bytes',()=>{
 assert.match(source,/PRIMARY KEY\s*\(tenant_id,custody_token_sha256\)/i);
 assert.match(source,/UNIQUE\s*\(tenant_id,kms_operation_id\)/i);
 assert.match(source,/UNIQUE\s*\(custody_token_sha256\)/i);
 assert.match(source,/CHECK\s*\(status = 'consumed' OR consumed_at IS NULL\)/i);
 assert.match(source,/CHECK\s*\(consumed_at IS NULL OR consumed_at >= claimed_at\)/i);
 assert.match(source,/octet_length\(custody_token_sha256\)=32/);
 assert.match(source,/status IN \('reserved','consumed','denied'\)/);
 assert.doesNotMatch(source,/\b(?:private_key|plaintext_dek|unwrapped_dek|secret_material)\s+(?:bytea|text)/i);
});
test('RLS is forced and unattended release has no SQL grants',()=>{
 assert.match(source,/ALTER TABLE gaiz2_kms_release_claims FORCE ROW LEVEL SECURITY;/);
 assert.match(source,/REVOKE ALL ON gaiz2_kms_release_claims FROM PUBLIC;/);
 assert.doesNotMatch(source,/^\s*GRANT\s+/im);
 assert.doesNotMatch(source,/^\s*CREATE\s+(?:OR REPLACE\s+)?FUNCTION\b/im);
 assert.match(source,/DO NOT RUN IN PRODUCTION/);
});
test('review requires fresh revocation, independent custody and reconciliation',()=>{
 assert.match(source,/FOR UPDATE/);
 assert.match(source,/Recheck authoritative key revocation at KMS key use/i);
 assert.match(source,/manual reconciliation/i);
 assert.match(source,/independent peer credential/i);
 assert.match(keyRegistry,/FORCE ROW LEVEL SECURITY/);
 assert.match(keyRegistry,/state IN \('pending','active','suspended','revoked','retired'\)/);
});
