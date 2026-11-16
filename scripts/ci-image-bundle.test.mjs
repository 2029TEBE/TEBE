import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateBundleManifest,verifyBundle,imageRuntimeIdentity} from './ci-image-bundle.mjs';
const expected={revision:'a'.repeat(40),runId:'123',repository:'2029TEBE/TEBE'};
const archive=Buffer.from('Synthetic archive data - never loaded by Docker in this unit test.');
const good={version:2,...expected,archiveSha256:createHash('sha256').update(archive).digest('hex'),images:{api:{id:'sha256:'+'b'.repeat(64),tag:'epmo-api:ci',runtimeDigest:'sha256:'+'d'.repeat(64)},web:{id:'sha256:'+'c'.repeat(64),tag:'epmo-web:ci',runtimeDigest:'sha256:'+'e'.repeat(64)}}};
const portable={Id:'sha256:'+'a'.repeat(64),Os:'linux',Architecture:'amd64',Config:{User:'pmo',Labels:{'org.opencontainers.image.revision':'a'.repeat(40)},Cmd:['node','server.js']},RootFS:{Type:'layers',Layers:['sha256:'+'b'.repeat(64)]}};
test('Docker 24 synthetic defaults and Docker 29 omitted empty config fields have identical identity',()=>{
 const older={...portable,Config:{...portable.Config,Hostname:'',Domainname:'',AttachStdin:false,AttachStdout:false,AttachStderr:false,Tty:false,OpenStdin:false,StdinOnce:false,Image:'',NetworkDisabled:false,MacAddress:'',StopTimeout:0,Entrypoint:[],Env:[],OnBuild:[],Volumes:{},WorkingDir:''}};
 assert.equal(imageRuntimeIdentity(older).runtimeDigest,imageRuntimeIdentity(portable).runtimeDigest);
 for(const value of [true,'non-default',1])assert.throws(()=>imageRuntimeIdentity({...older,Config:{...older.Config,OpenStdin:value}}));
});
test('portable normalization preserves all execution settings and empty-valued label keys',()=>{
 const base=imageRuntimeIdentity(portable).runtimeDigest;
 for(const change of [{Entrypoint:['sh']},{Env:['FLAG=1']},{OnBuild:['RUN false']},{WorkingDir:'/app'},{Volumes:{'/data':{}}},{Labels:{...portable.Config.Labels,flag:''}},{Healthcheck:{Test:['CMD','false']}},{StopSignal:'SIGKILL'},{FutureRuntimeSetting:false}]){
  assert.notEqual(imageRuntimeIdentity({...portable,Config:{...portable.Config,...change}}).runtimeDigest,base);
 }
});
test('bundle metadata binds immutable image IDs, commit, repository and CI run',()=>{
 assert.equal(validateBundleManifest(good,expected).apiTag,'epmo-release-api:'+expected.revision);
 for(const extra of [{revision:'d'.repeat(40)},{runId:'124'},{repository:'other/repo'},{archiveSha256:'x'},{extra:'unknown'}])assert.throws(()=>validateBundleManifest({...good,...extra},expected));
 assert.throws(()=>validateBundleManifest({...good,images:{...good.images,api:{id:'latest',tag:'epmo-api:ci'}}},expected));
 assert.throws(()=>validateBundleManifest({...good,images:{...good.images,api:{...good.images.api,tag:'untrusted/image:latest'}}},expected));
});
test('bundle verifies actual archive bytes and refuses tampering and symlinks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'epmo-image-test-'));try{
  await writeFile(join(dir,'manifest.json'),JSON.stringify(good));await writeFile(join(dir,'images.tar.gz'),archive);
  assert.equal((await verifyBundle(dir,expected)).runId,'123');
  await writeFile(join(dir,'images.tar.gz'),Buffer.concat([archive,Buffer.from('tamper')]));await assert.rejects(verifyBundle(dir,expected));
  await rm(join(dir,'images.tar.gz'));await writeFile(join(dir,'actual'),archive);await symlink(join(dir,'actual'),join(dir,'images.tar.gz'));await assert.rejects(verifyBundle(dir,expected));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('runtime identity survives daemon index/config ID differences but rejects changed runtime bytes',()=>{
 const image={Id:'sha256:'+'a'.repeat(64),Os:'linux',Architecture:'amd64',Config:{User:'pmo',Labels:{'org.opencontainers.image.revision':'a'.repeat(40)},Cmd:['node','server.js'],Env:['NODE_ENV=production']},RootFS:{Type:'layers',Layers:['sha256:'+'b'.repeat(64)]}};
 const base=imageRuntimeIdentity(image).runtimeDigest;
 assert.equal(imageRuntimeIdentity({...image,Id:'sha256:'+'c'.repeat(64),Config:{...image.Config,Unused:null}}).runtimeDigest,base);
 for(const changed of [{...image,Config:{...image.Config,Cmd:['sh']}},{...image,RootFS:{Type:'layers',Layers:['sha256:'+'d'.repeat(64)]}},{...image,Config:{...image.Config,Env:['NODE_ENV=development']}}])assert.notEqual(imageRuntimeIdentity(changed).runtimeDigest,base);
 assert.throws(()=>imageRuntimeIdentity({...image,Architecture:'arm64'}));
});

