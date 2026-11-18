import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {previewGaizFieldMapping} from './gaiz-mapping-preview.mjs';
const uuid='11111111-1111-4111-8111-111111111111';
const target='22222222-2222-4222-8222-222222222222';
const report={title:'Synthetic board report',summary:'تقرير تجريبي 😃',metrics:{completed:3},findings:[{id:1,description:'Synthetic'}]};
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const hash=v=>createHash('sha256').update(v).digest('hex');
const receipt={reportSha256:hash(canonical(report)),artifactSha256:'a'.repeat(64),tenantId:uuid,validated:true};
const project={kind:'project',id:target,tenantId:uuid,revision:4,fields:{name:'Existing project'}};
const profile={profileId:'project-name-v1',approved:true,tenantId:uuid,targetKind:'project',fieldMappings:['project.name']};
const opts={tenantId:uuid,report,custodyReceipt:receipt,snapshot:project,mappingProfile:profile};
test('project name diff contains no report text, requires second review and no writes',()=>{
 const result=previewGaizFieldMapping(opts);
 assert.equal(result.changeCount,1);
 assert.deepEqual(result.conflicts,['project.name']);
 assert.equal(result.proposedFields[0].expectedRevision,4);
 assert.equal(result.proposedFields[0].decision,'requires_manual_review');
 assert.equal(result.importAllowed,false);assert.equal(result.appliesData,false);
 assert.equal(result.containsPlaintext,false);
 assert.doesNotMatch(JSON.stringify(result),/Synthetic board report|Existing project|تقرير تجريبي/);
});
test('no-op preview is distinguished from manual change and hash is revision-bound',()=>{
 const a=previewGaizFieldMapping({...opts,snapshot:{...project,fields:{name:report.title}}});
 assert.equal(a.changeCount,0);
 assert.equal(a.proposedFields[0].decision,'no_change');
 const b=previewGaizFieldMapping({...opts,snapshot:{...project,revision:5}});
 assert.notEqual(b.previewSha256,previewGaizFieldMapping(opts).previewSha256);
});
test('portfolio description mapping uses summary, not fabricated progress or health',()=>{
 const snapshot={kind:'portfolio',id:target,tenantId:uuid,revision:2,fields:{description:null}};
 const mappingProfile={profileId:'portfolio-summary-v1',approved:true,tenantId:uuid,targetKind:'portfolio',fieldMappings:['portfolio.description']};
 const result=previewGaizFieldMapping({...opts,snapshot,mappingProfile});
 assert.equal(result.proposedFields[0].sourceField,'report.summary');
 assert.equal(result.changeCount,1);
 assert.equal(result.proposedFields[0].oldSha256,null);
});
test('forged source, cross-tenant target, unapproved profile, unsupported field and unsafe markup denied',()=>{
 const bad=[
  {tenantId:'33333333-3333-4333-8333-333333333333'},
  {custodyReceipt:{...receipt,reportSha256:'b'.repeat(64)}},
  {custodyReceipt:{...receipt,validated:false}},
  {report:{...report,summary:'<script>alert(1)</script>'}},
  {report:{...report,unknown:true}},
  {snapshot:{...project,tenantId:'33333333-3333-4333-8333-333333333333'}},
  {snapshot:{...project,revision:-1}},
  {mappingProfile:{...profile,approved:false}},
  {mappingProfile:{...profile,fieldMappings:['project.progressPct']}},
  {mappingProfile:{...profile,fieldMappings:['project.name','project.name']}},
  {mappingProfile:{...profile,tenantId:'33333333-3333-4333-8333-333333333333'}},
 ];
 for(const change of bad)assert.throws(()=>previewGaizFieldMapping({...opts,...change}));
});
