// Isolated PostgreSQL-WASM acceptance; no production credentials or DB connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {randomUUID,generateKeyPairSync,sign,privateDecrypt,constants,createHash} from 'node:crypto';
import {createPgGaizExecutor,createPgGaizPolicyStore} from '../../apps/api/src/gaiz/runtime/pg-executor.mjs';
import {digest,signEnvelope} from '../../apps/api/src/gaiz/runtime/protocol.mjs';
import {previewGaizFieldMapping} from '../../apps/api/src/gaiz/gaiz-mapping-preview.mjs';
const to=process.env.GAIZ_TO_CHECKOUT;
if(!to||!process.env.PGLITE_MODULE)throw Error('Set GAIZ_TO_CHECKOUT and PGLITE_MODULE to pinned local checkouts');
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE));
const {createGaiz2WithSigner}=await import(pathToFileURL(to+'/gaiz/v2.mjs'));
const {createTrustedGaizRuntime}=await import(pathToFileURL(to+'/gaiz/runtime/trusted-runtime.mjs'));
const {quarantineGovernanceReport}=await import(pathToFileURL(to+'/gaiz/quarantine.mjs'));
const T=randomUUID(),U=randomUUID(),R=randomUUID(),A=randomUUID(),S=randomUUID(),C=randomUUID(),P=randomUUID();
const issuer=generateKeyPairSync('ed25519'),custodian=generateKeyPairSync('ed25519'),broker=generateKeyPairSync('ed25519'),recipient=generateKeyPairSync('rsa',{modulusLength:3072});
const pem=k=>k.export({type:'spki',format:'pem'}),fp=k=>createHash('sha256').update(k.export({type:'spki',format:'der'})).digest('hex');
const report={title:'Updated synthetic project',summary:'مرحبا — trusted synthetic report',metrics:{completed:3}};
const artifact=await createGaiz2WithSigner({report,manifest:{version:2,schemaVersion:1,artifactId:'synthetic-01',issuerId:'issuer-01',tenantScope:T,contentType:'application/vnd.orgaiz.report+json',createdAt:new Date().toISOString()},recipients:[{keyId:'recipient-01',publicKey:recipient.publicKey}],signer:async b=>sign(null,b,issuer.privateKey)});
const artifactHash=createHash('sha256').update(artifact).digest('hex'),reportHash=quarantineGovernanceReport(report).reportSha256;
async function fixture(kind='project'){
 const db=new PGlite();
 await db.exec('CREATE TABLE tenants(id uuid PRIMARY KEY);CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE projects(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,name text NOT NULL);CREATE TABLE portfolios(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,description text);CREATE TABLE audit_events(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,actor_id uuid,entity text,entity_id uuid,action text,diff jsonb);');
 for(const name of ['0020_gaiz_import_staging','0021_gaiz_custody_attempts','0022_gaiz_import_authorizations','0023_gaiz_entity_revisions','0024_gaiz_mapping_profiles','0025_gaiz_mapping_profile_binding','0026_gaiz_trust_directory','0027_gaiz_execution_ledger'])await db.exec(await readFile(new URL('../../packages/db/migrations/'+name+'.sql',import.meta.url),'utf8'));
 const q=(sql,args)=>db.query(sql,args);
 await q('INSERT INTO tenants VALUES($1)',[T]);for(const u of [U,R])await q('INSERT INTO users VALUES($1)',[u]);
 if(kind==='project')await q('INSERT INTO projects(id,tenant_id,name) VALUES($1,$2,$3)',[P,T,'Old synthetic project']);
 else await q('INSERT INTO portfolios(id,tenant_id,description) VALUES($1,$2,$3)',[P,T,null]);
 const snapshot={id:P,tenantId:T,kind,revision:0,fields:kind==='project'?{name:'Old synthetic project'}:{description:null}};
 const preview=previewGaizFieldMapping({tenantId:T,report,snapshot,custodyReceipt:{reportSha256:reportHash,artifactSha256:artifactHash,tenantId:T,validated:true},mappingProfile:{profileId:'project-title',approved:true,tenantId:T,targetKind:kind,fieldMappings:[kind==='project'?'project.name':'portfolio.description']}});
 await q("INSERT INTO gaiz_import_requests(id,tenant_id,artifact_id,sha256,issuer_id,requested_by,reviewed_by,status,reviewed_at) VALUES($1,$2,'synthetic-01',$3,'issuer-01',$4,$5,'approved',now())",[S,T,artifactHash,U,R]);
 await q("INSERT INTO gaiz_custody_attempts(id,tenant_id,review_id,artifact_sha256,recipient_key_id,requested_by,status,report_sha256,completed_at) VALUES($1,$2,$3,$4,'recipient-01',$5,'validated',$6,now())",[C,T,S,artifactHash,U,reportHash]);
 await q("INSERT INTO gaiz_mapping_profiles(tenant_id,profile_id,target_kind,field_mappings,requested_by,reviewed_by,status,reviewed_at) VALUES($1,'project-title',$4,$5,$2,$3,'approved',now())",[T,U,R,kind,JSON.stringify([kind==='project'?'project.name':'portfolio.description'])]);
 await q("INSERT INTO gaiz_import_authorizations(id,tenant_id,staging_review_id,custody_attempt_id,target_kind,target_id,target_snapshot_sha256,preview_sha256,mapping_profile_id,requested_by,approved_by,status,reviewed_at) VALUES($1,$2,$3,$4,$10,$5,$6,$7,'project-title',$8,$9,'approved',now())",[A,T,S,C,P,digest(snapshot),preview.previewSha256,U,R,kind]);
 for(const [kind,id,key]of [['issuer','issuer-01',issuer.publicKey],['recipient','recipient-01',recipient.publicKey],['custodian','custodian-01',custodian.publicKey]])await q("INSERT INTO gaiz_trust_keys(tenant_id,key_id,key_kind,algorithm,owner_type,public_key_pem,public_key_sha256,status,valid_from,valid_until,registered_by,approved_by,approved_at) VALUES($1,$2,$3,$4,'customer',$5,$6,'active',now()-interval '1 day',now()+interval '1 day',$7,$8,now())",[T,id,kind,kind==='recipient'?'RSA-OAEP-SHA256':'Ed25519',pem(key),fp(key),U,R]);
 // Restricted role exercises FORCE RLS with real PostgreSQL policy evaluation.
 await db.exec('CREATE ROLE gaiz_worker; GRANT USAGE ON SCHEMA public TO gaiz_worker; GRANT SELECT ON ALL TABLES IN SCHEMA public TO gaiz_worker; GRANT UPDATE(status) ON gaiz_import_authorizations,gaiz_import_requests,gaiz_custody_attempts,gaiz_mapping_profiles TO gaiz_worker; GRANT EXECUTE ON FUNCTION gaiz_lock_trust_key(uuid,text,text),gaiz_lock_recovery_consent(uuid,text,timestamptz) TO gaiz_worker; GRANT UPDATE(name) ON projects TO gaiz_worker; GRANT UPDATE(description) ON portfolios TO gaiz_worker; GRANT INSERT ON gaiz_execution_grants,audit_events TO gaiz_worker; GRANT UPDATE(state,consumed_at,result_sha256) ON gaiz_execution_grants TO gaiz_worker;');
 let failAudit=false;
 const transaction=async(tenant,fn)=>db.transaction(async tx=>{
  await tx.exec('SET LOCAL ROLE gaiz_worker');await tx.query("SELECT set_config('app.tenant_id',$1,true)",[tenant]);
  return fn({query:async(sql,args)=>{if(failAudit&&sql.includes('gaiz.import.committed'))throw Error('Synthetic audit outage');return tx.query(sql,args);}});
 });
 const executor=createPgGaizExecutor({transaction,grantPublicKey:broker.publicKey,signGrant:async b=>sign(null,b,broker.privateKey)});
 const ctx={tenantId:T,userId:R,capabilities:['pmoa_admin']};
 let claimed=false,unwrapCount=0;
 const policyStore=createPgGaizPolicyStore({transaction,custodyRoutes:{[T]:{'recipient-01':{name:'recipient',version:1,spkiSha256:fp(recipient.publicKey)},'custodian-01':{name:'custodian',version:1,spkiSha256:fp(custodian.publicKey)}}}});
 const runtime=createTrustedGaizRuntime({grantPublicKey:broker.publicKey,policyStore,custody:{unwrap:async b=>{unwrapCount++;return privateDecrypt({key:recipient.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},b);},sign:async b=>sign(null,b,custodian.privateKey)},ledger:{claim:async()=>{if(claimed)throw Error('Replay');claimed=true;},complete:async()=>{}}});
 const issue=()=>executor.issue(ctx,{authorizationId:A,custodianId:'custodian-01'});
 return {db,executor,ctx,runtime,issue,artifact,failAudit:()=>{failAudit=true;},revoke:()=>db.query("UPDATE gaiz_trust_keys SET status='revoked',revoked_at=now() WHERE key_id='recipient-01'"),unwraps:()=>unwrapCount};
}
test('same contract bytes in TO and TEBE',async()=>assert.equal(await readFile(to+'/gaiz/runtime/protocol.mjs','utf8'),await readFile(new URL('../../apps/api/src/gaiz/runtime/protocol.mjs',import.meta.url),'utf8')));
test('real encrypted TO artifact → trusted runtime → atomic TEBE CAS, audit and replay rejection',async()=>{
 const f=await fixture();try{const request=await f.issue();const result=await f.runtime.execute({...request,artifact});const committed=await f.executor.commit(f.ctx,result);assert.equal(committed.revision,1);assert.equal((await f.db.query('SELECT name FROM projects')).rows[0].name,report.title);assert.equal((await f.db.query('SELECT state FROM gaiz_execution_grants')).rows[0].state,'consumed');await assert.rejects(f.executor.commit(f.ctx,result));await assert.rejects(f.runtime.execute({...request,artifact}));assert.equal(f.unwraps(),1);}finally{await f.db.close();}
});
test('audit failure rolls back patch, revision and one-time consumption',async()=>{
 const f=await fixture();try{const request=await f.issue(),result=await f.runtime.execute({...request,artifact});f.failAudit();await assert.rejects(f.executor.commit(f.ctx,result));assert.equal((await f.db.query('SELECT revision FROM projects')).rows[0].revision,0);assert.equal((await f.db.query('SELECT state FROM gaiz_execution_grants')).rows[0].state,'issued');}finally{await f.db.close();}
});
test('cross-tenant, tampered artifact, changed target and revoked key fail closed',async()=>{
 const f=await fixture();try{await assert.rejects(f.executor.issue({...f.ctx,tenantId:randomUUID()},{authorizationId:A,custodianId:'custodian-01'}));const request=await f.issue();const bad=Buffer.from(artifact);bad[10]^=1;await assert.rejects(f.runtime.execute({...request,artifact:bad}));assert.equal(f.unwraps(),0);const result=await f.runtime.execute({...request,artifact});await f.db.query('UPDATE projects SET name=$1 WHERE id=$2',['Changed concurrently',P]);await assert.rejects(f.executor.commit(f.ctx,result));assert.equal((await f.db.query('SELECT state FROM gaiz_execution_grants')).rows[0].state,'issued');}finally{await f.db.close();}
 const g=await fixture();try{const request=await g.issue();await g.revoke();await assert.rejects(g.runtime.execute({...request,artifact}));assert.equal(g.unwraps(),0);}finally{await g.db.close();}
});
test('result forgery and current database trust revocation reject without writes',async()=>{
 const f=await fixture();try{const request=await f.issue(),result=await f.runtime.execute({...request,artifact});const forged=structuredClone(result);forged.payload.patch.value='Forged';await assert.rejects(f.executor.commit(f.ctx,forged));
 const signedWrongPatch=await signEnvelope('result',forged.payload,async b=>sign(null,b,custodian.privateKey));await assert.rejects(f.executor.commit(f.ctx,signedWrongPatch));await f.db.query("UPDATE gaiz_trust_keys SET status='revoked',revoked_at=now() WHERE key_id='custodian-01'");await assert.rejects(f.executor.commit(f.ctx,result));assert.equal((await f.db.query('SELECT revision FROM projects')).rows[0].revision,0);}finally{await f.db.close();}
});

test('read-only trust lock functions preserve tenant scope and deny registry writes',async()=>{
 const f=await fixture();try{
  await f.db.transaction(async tx=>{
   await tx.exec('SET LOCAL ROLE gaiz_worker');await tx.query("SELECT set_config('app.tenant_id',$1,true)",[randomUUID()]);
   assert.equal((await tx.query('SELECT * FROM gaiz_lock_trust_key($1,$2,$3)',[T,'issuer','issuer-01'])).rows.length,0);
  });
  await assert.rejects(f.db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE gaiz_worker');await tx.query("UPDATE gaiz_trust_keys SET status='revoked'");}));
 }finally{await f.db.close();}
});

test('portfolio null description maps to reviewed report summary only',async()=>{
 const f=await fixture('portfolio');try{const request=await f.issue(),result=await f.runtime.execute({...request,artifact});await f.executor.commit(f.ctx,result);assert.equal((await f.db.query('SELECT description,revision FROM portfolios')).rows[0].description,report.summary);}finally{await f.db.close();}
});
test('platform recipient requires explicit import-purpose consent, not metadata-only consent',async()=>{
 const f=await fixture();try{
  await f.db.query("UPDATE gaiz_trust_keys SET owner_type='platform' WHERE key_id='recipient-01'");
  await assert.rejects(f.issue());
  await f.db.query("INSERT INTO gaiz_recovery_consents(tenant_id,consent_id,recipient_key_id,purpose,status,requested_by,approved_by,approved_at,expires_at) VALUES($1,'consent-1','recipient-01','custodian-validation-only','approved',$2,$3,now(),now()+interval '1 day')",[T,U,R]);
  await assert.rejects(f.issue());
  await f.db.query("UPDATE gaiz_recovery_consents SET purpose='approved-field-import'");
  const request=await f.issue(),result=await f.runtime.execute({...request,artifact});await f.executor.commit(f.ctx,result);
 }finally{await f.db.close();}
});
