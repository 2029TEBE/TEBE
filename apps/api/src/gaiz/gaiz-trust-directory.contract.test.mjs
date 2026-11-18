import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=p=>readFileSync(new URL('../../../../'+p,import.meta.url),'utf8');
const local=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration=root('packages/db/migrations/0026_gaiz_trust_directory.sql');
const rls=root('packages/db/sql/rls.sql');
const dir=local('./gaiz-trust-directory.service.ts');
const handoff=local('./gaiz-custody-handoff.service.ts');
const controller=local('./gaiz.controller.ts');

test('trust and consent records are tenant-RLS protected public metadata only',()=>{
 assert.match(migration,/CREATE TABLE public.gaiz_trust_keys/);
 assert.match(migration,/CREATE TABLE public.gaiz_recovery_consents/);
 assert.match(migration,/FOREIGN KEY \(tenant_id,key_kind,recipient_key_id\)/);
 assert.match(migration,/FORCE ROW LEVEL SECURITY/g);
 assert.match(migration,/gaiz_trust_key_scope UNIQUE \(tenant_id,key_kind,key_id\)/);
 assert.match(migration,/approved_by<>registered_by/);
 assert.match(migration,/approved_by<>requested_by/);
 // Inspect SQL definitions; comments explicitly prohibit secret columns.
 assert.doesNotMatch(migration.replace(/--[^\n]*/g,''),/private_key|secret_key|encrypted_payload|plaintext|dek\s+bytea/i);
});
test('application role may only read trust roots and customer consent',()=>{
 for(const table of ['gaiz_trust_keys','gaiz_recovery_consents']){
  assert.match(rls,new RegExp('REVOKE INSERT, UPDATE, DELETE ON public\\.'+table+' FROM pmo_app'));
  assert.match(rls,new RegExp('GRANT SELECT ON public\\.'+table+' TO pmo_app'));
 }
});
test('trusted registry fails closed on expiry, revocation, key fingerprint and tenant',()=>{
 assert.match(dir,/GAIZ_TRUST_DIRECTORY_ENABLED !== 'true'/);
 assert.match(dir,/NODE_ENV !== 'development'/);
 assert.match(dir,/withTenant\(tenantId/);
 assert.match(dir,/eq\(gaizTrustKeys.status,'active'\)/);
 assert.match(dir,/isNull\(gaizTrustKeys.revokedAt\)/);
 assert.match(dir,/eq\(gaizRecoveryConsents.status,'approved'\)/);
 assert.match(dir,/isNull\(gaizRecoveryConsents.revokedAt\)/);
 assert.match(dir,/publicKeySha256/);
 assert.match(dir,/asymmetricKeyType/);
 assert.match(dir,/approved.approvedBy===approved.requestedBy/);
});
test('handoff no longer accepts untrusted public keys from caller and no decrypt route',()=>{
 assert.match(handoff,/this.trustDirectory.loadRecipient\(query\)/);
 assert.match(handoff,/this.trustDirectory.loadCustodianTrust/);
 assert.doesNotMatch(handoff,/trusted\.loadRecipient|trusted\.loadCustodianTrust/);
 assert.doesNotMatch(controller,/@Post\('custody|@Post\('decrypt/);
});
