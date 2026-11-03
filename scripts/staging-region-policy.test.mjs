import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './staging-region-policy.mjs';
const base={
 profile:'shared-sa',provider:'UNVERIFIED_PROVIDER',region:'sa-approved-placeholder',
 approvedRegions:['sa-approved-placeholder'],sourceSha:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64),
 networkId:'network-placeholder',databaseId:'database-placeholder',storageId:'bucket-placeholder',
 kmsKeyId:'kms-placeholder',secretStoreId:'vault-placeholder',logSinkId:'logs-placeholder',
 backupVaultId:'backup-placeholder',restoreTargetId:'isolated-restore-placeholder',
 apiOrigin:'https://api.example.invalid/',webOrigin:'https://app.example.invalid/',
 tlsMode:'enforced',wafMode:'enforced',backupEncrypted:true,logsRedacted:true,
 restoreIsolated:true,databaseMigrationMode:'expand-only',stripeMode:'test',
 allowLivePayments:false,secretsInRepo:false,usesStaticCloudKeys:false,
 deploymentAuthorized:false,tenantIsolation:'rls-enforced'
};
test('shared and dedicated templates satisfy offline structural policy',()=>{
 assert.deepEqual(validate(base),[]);
 assert.deepEqual(validate({...base,profile:'dedicated-sa',tenantIsolation:undefined,sharedResourceIds:[]}),[]);
});
for(const [label,patch] of Object.entries({
 'unapproved region':{region:'us-east-1'},
 'mutable source':{sourceSha:'main'},
 'mutable image':{imageDigest:'latest'},
 'HTTP origin':{apiOrigin:'http://api.example.invalid/'},
 'embedded credentials':{webOrigin:'https://user:password@app.example.invalid/'},
 'disabled WAF':{wafMode:'disabled'},
 'unencrypted backups':{backupEncrypted:false},
 'nonisolated restore':{restoreIsolated:false},
 'destructive migration':{databaseMigrationMode:'reset'},
 'live billing':{stripeMode:'live'},
 'live charges':{allowLivePayments:true},
 'committed secrets':{secretsInRepo:true},
 'static credentials':{usesStaticCloudKeys:true},
 'unauthorized deploy':{deploymentAuthorized:true},
 'shared dedicated resource':{profile:'dedicated-sa',sharedResourceIds:['shared-db']},
 'missing tenant isolation':{tenantIsolation:'none'}
})) test('rejects '+label,()=>assert.ok(validate({...base,...patch}).length>0));
