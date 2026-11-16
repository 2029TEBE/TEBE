import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration=file('../../../../packages/db/migrations/0024_gaiz_mapping_profiles.sql');
const binding=file('../../../../packages/db/migrations/0025_gaiz_mapping_profile_binding.sql');
const grants=file('../../../../packages/db/sql/rls.sql');
const registry=file('./gaiz-mapping-registry.service.ts');
const authorization=file('./gaiz-import-authorization.service.ts');
const readiness=file('./gaiz-commit-readiness.service.ts');
const controller=file('./gaiz.controller.ts');
test('tenant-bound mapping registry has dual review and immutable field allowlist',()=>{
 assert.match(migration,/FORCE ROW LEVEL SECURITY/);
 assert.match(migration,/reviewed_by <> requested_by/);
 assert.match(migration,/field_mappings='\["project.name"\]'::jsonb/);
 assert.match(migration,/field_mappings='\["portfolio.description"\]'::jsonb/);
 assert.match(grants,/REVOKE DELETE, UPDATE, INSERT ON public.gaiz_mapping_profiles/);
 assert.match(registry,/GAIZ_MAPPING_REGISTRY_ENABLED/);
 assert.match(registry,/onConflictDoNothing/);
 assert.match(registry,/gaiz.mapping.approved/);
});
test('import authorization uses signed custody preview and exact persisted profile',()=>{
 assert.match(authorization,/verifyMappingPreviewReceipt/);
 assert.match(authorization,/mappingRegistry.getApprovedInternal/);
 assert.match(authorization,/review.sha256 !== input.artifactSha256/);
 assert.match(authorization,/mappingProfileId:input.mappingProfileId/);
 assert.match(binding,/FOREIGN KEY \(tenant_id,mapping_profile_id,target_kind\)/);
 assert.match(binding,/ON DELETE RESTRICT/);
});
test('readiness takes tenant-scoped locks but never writes or exposes plaintext',()=>{
 assert.match(readiness,/GAIZ_COMMIT_READINESS_ENABLED/);
 assert.match(readiness,/for\('update'\)/);
 assert.match(readiness,/fingerprintGaizTarget\(snapshot\)/);
 assert.match(readiness,/gaizMappingProfiles.profileId,a.mappingProfileId/);
 assert.match(readiness,/importAllowed:false,appliesData:false/);
 assert.doesNotMatch(readiness,/tx\.update\(projects\)|tx\.update\(portfolios\)/);
 assert.doesNotMatch(controller,/@Post\('import\/commit|@Post\('import\/apply/);
});
