import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSyntheticDrill } from './staging-synthetic-recovery.mjs';
const fake = String.raw`#!/usr/bin/env node
const fs=require('node:fs');const path=require('node:path');
const raw=process.argv.slice(2), bin=path.basename(process.argv[1]);
if(bin==='docker' && (raw[0]!=='--host'||raw[1]!=='unix:///var/run/docker.sock'))process.exit(9);
const args=bin==='docker'?raw.slice(2):raw;
const dir=__DIR__;const log=__LOG__;const corrupt=__CORRUPT__;const unsafe=__UNSAFE__;const failCleanup=__FAIL_CLEANUP__;const invalidDump=__INVALID_DUMP__;const rejectToc=__REJECT_TOC__;
const write=(s)=>fs.appendFileSync(log,s+'\n');
const state=n=>path.join(dir,n+'.state');
if(bin==='docker'){
 const op=args[0];
 if(op==='image'&&args[1]==='inspect'){write('image-inspect');}
 else if(op==='run') {const n=args[args.indexOf('--name')+1];fs.writeFileSync(state(n),'new');write('run '+n);process.stdout.write(n);}
 else if(op==='rm') {const n=args.at(-1);if(failCleanup&&!fs.existsSync(path.join(dir,'failed-once'))){fs.writeFileSync(path.join(dir,'failed-once'),'1');write('rm-failed '+n);process.exit(9);}fs.rmSync(state(n),{force:true});write('rm '+n);}
 else if(op==='exec') {
   const n=args[args[1]==='-i'?2:1],cmd=args.find(x=>['psql','pg_dump','pg_restore','pg_isready'].includes(x));
   if(cmd==='pg_isready')process.stdout.write('ready');
   else if(cmd==='pg_dump'){write('dump');process.stdout.write((invalidDump?'BROKEN':'PGDMP')+('synthetic'.repeat(35)));}
   else if(cmd==='pg_restore'){fs.readFileSync(0);if(args.includes('--list')){write('archive-list');if(rejectToc)process.exit(9);}else{fs.writeFileSync(state(n),'restored');write('restore '+n);}}
   else if(cmd==='psql'){
     const query=args[args.indexOf('-c')+1]||'';
     if(query.includes('SELECT id,marker')){
       const current=fs.readFileSync(state(n),'utf8');
       process.stdout.write(current==='corrupt'?'1|S34_SYNTHETIC_CORRUPTED\n2|S34_SYNTHETIC_B\n':'1|S34_SYNTHETIC_A\n2|S34_SYNTHETIC_B\n');
     } else if(query.includes('UPDATE')){fs.writeFileSync(state(n),'corrupt');write('mutate '+n);}
     else {fs.readFileSync(0);fs.writeFileSync(state(n),'seeded');write('seed '+n);}
   }
 }else process.exit(9);
}else if(bin==='aws'){
 const op=args[0];
 if(op==='s3api'){
  const action=args[1];
  if(action==='get-public-access-block'){
    write('bucket-public-access');
    const block={BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:!unsafe,RestrictPublicBuckets:true};
    process.stdout.write(JSON.stringify({PublicAccessBlockConfiguration:block}));
  }else if(action==='get-bucket-location'){
    write('bucket-location');
    process.stdout.write(JSON.stringify({LocationConstraint:'eu-central-1'}));
  }else if(action==='get-bucket-encryption'){
    write('bucket-encryption');
    process.stdout.write(JSON.stringify({ServerSideEncryptionConfiguration:{Rules:[{ApplyServerSideEncryptionByDefault:{SSEAlgorithm:'AES256'}}]}}));
  }else if(action==='head-object'){
    const key=args[args.indexOf('--key')+1];
    if(!fs.existsSync(path.join(dir,path.basename(key))))process.exit(9);
    write('remote-head');
  }else process.exit(9);
 }
 else if(op==='s3'&&args[1]==='cp'){
   const src=args[2],dst=args[3],remote=x=>x.startsWith('s3://'),local=x=>path.join(dir,path.basename(x));
   if(remote(src)){fs.copyFileSync(local(src),dst);if(corrupt){const b=fs.readFileSync(dst);b[b.length-1]^=1;fs.writeFileSync(dst,b);}write('remote-download');}
   else if(remote(dst)){fs.copyFileSync(src,local(dst));write('remote-upload');}
   else process.exit(9);
 }else process.exit(9);
}else process.exit(9);
`;
function fixture(corrupt=false, unsafe=false, failCleanup=false, invalidDump=false, rejectToc=false) {
 const dir=mkdtempSync(join(tmpdir(),'epmo-s34-flow-'));
 const bin=join(dir,'bin');mkdirSync(bin);
 const fakeCode=fake.replaceAll('__DIR__',JSON.stringify(dir))
   .replaceAll('__LOG__',JSON.stringify(join(dir,'calls.log')))
   .replaceAll('__CORRUPT__',JSON.stringify(corrupt))
   .replaceAll('__UNSAFE__',JSON.stringify(unsafe))
   .replaceAll('__FAIL_CLEANUP__',JSON.stringify(failCleanup))
   .replaceAll('__INVALID_DUMP__',JSON.stringify(invalidDump))
   .replaceAll('__REJECT_TOC__',JSON.stringify(rejectToc));
 for(const name of ['docker','aws']){const p=join(bin,name);writeFileSync(p,fakeCode);chmodSync(p,0o700);}
 const key=join(dir,'key');writeFileSync(key,randomBytes(32));chmodSync(key,0o600);
 const env={PATH:bin+':'+process.env.PATH,
  DEPLOYMENT_ENV:'staging',EPMO_SYNTHETIC_ONLY:'YES',EPMO_REMOTE_IO_APPROVED:'YES',
  EPMO_RECOVERY_S3_PREFIX:'s3://epmo-test-bucket/epmo-synthetic-drills/staging',
  EPMO_RECOVERY_KEY_FILE:key,EPMO_PG_IMAGE:'postgres:16-alpine@sha256:'+'a'.repeat(64),
  AWS_ACCESS_KEY_ID:'SYNTHETIC_TEST_ONLY',AWS_SECRET_ACCESS_KEY:'SYNTHETIC_TEST_ONLY',
  AWS_REGION:'eu-central-1'};
 return {dir,env};
}
test('S34 executes synthetic remote roundtrip, injected failure and clean rollback with no container leak',async()=>{
 const {dir,env}=fixture();
 try{
  const r=await runSyntheticDrill(env,{socketCheck:()=>true});
  assert.equal(r.result,'synthetic-drill-only');
  const lines=readFileSync(join(dir,'calls.log'),'utf8').trim().split('\n');
  assert.deepEqual(lines.slice(0,3), ['bucket-public-access','bucket-location','bucket-encryption']);
  assert.ok(lines.indexOf('bucket-encryption') < lines.indexOf('image-inspect'));
  assert.equal(lines.filter(x=>x.startsWith('run ')).length,3);
  assert.equal(lines.filter(x=>x.startsWith('restore ')).length,2);
  assert.equal(lines.filter(x=>x.startsWith('rm ')).length,3);
  assert.equal(lines.filter(x=>x.startsWith('mutate ')).length,1);
  assert.ok(lines.indexOf('archive-list')>lines.indexOf('dump'));
  assert.ok(lines.indexOf('archive-list')<lines.indexOf('remote-upload'));
  assert.ok(lines.indexOf('remote-upload')<lines.indexOf('remote-download'));
  assert.ok(lines.indexOf('remote-download')<lines.findIndex(x=>x.startsWith('restore ')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('S34 corrupted off-host archive blocks restore and cleans disposable source',async()=>{
 const {dir,env}=fixture(true);
 try{
  await assert.rejects(runSyntheticDrill(env,{socketCheck:()=>true}));
  const lines=readFileSync(join(dir,'calls.log'),'utf8').trim().split('\n');
  assert.equal(lines.filter(x=>x.startsWith('restore ')).length,0);
  assert.equal(lines.filter(x=>x.startsWith('rm ')).length,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('S40 rejects unsafe TEST bucket before Docker inspect, containers or S3 write',async()=>{
 const {dir,env}=fixture(false,true);
 try{
  await assert.rejects(runSyntheticDrill(env,{socketCheck:()=>true}),/public access/);
  const lines=readFileSync(join(dir,'calls.log'),'utf8').trim().split('\n');
  assert.deepEqual(lines,['bucket-public-access','bucket-location','bucket-encryption']);
  assert.ok(!lines.some(x=>x==='image-inspect'||x.startsWith('run ')||x==='remote-upload'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});


test('S41 fails closed if a disposable container cannot be removed after successful restore', async () => {
 const {dir,env}=fixture(false,false,true);
 try {
  await assert.rejects(runSyntheticDrill(env,{socketCheck:()=>true}),/cleanup failed; no PASS accepted/);
  const lines=readFileSync(join(dir,'calls.log'),'utf8').trim().split('\n');
  assert.equal(lines.filter(x=>x.startsWith('run ')).length,3);
  assert.equal(lines.filter(x=>x.startsWith('restore ')).length,2);
  assert.equal(lines.filter(x=>x.startsWith('rm-failed ')).length,1);
  assert.equal(lines.filter(x=>x.startsWith('rm ')).length,2);
  assert.equal(lines.filter(x=>x.startsWith('rm')).length,3,
    'all three removals must be attempted despite the first failure');
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('S41 attempts cleanup and rejects success after corruption plus failed removal', async () => {
 const {dir,env}=fixture(true,false,true);
 try {
  await assert.rejects(runSyntheticDrill(env,{socketCheck:()=>true}),/cleanup failed; no PASS accepted/);
  const lines=readFileSync(join(dir,'calls.log'),'utf8').trim().split('\n');
  assert.equal(lines.filter(x=>x.startsWith('restore ')).length,0);
  assert.equal(lines.filter(x=>x.startsWith('rm-failed ')).length,1);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('S51 rejects non-PGDMP output before off-host write and cleans source', async () => {
 const {dir,env}=fixture(false,false,false,true);
 try {
  await assert.rejects(runSyntheticDrill(env,{socketCheck:()=>true}),/custom archive is invalid/);
  const lines=readFileSync(join(dir,'calls.log'),'utf8').trim().split('\n');
  assert.equal(lines.filter(x=>x==='dump').length,1);
  assert.equal(lines.filter(x=>x==='archive-list').length,0);
  assert.equal(lines.filter(x=>x==='remote-upload').length,0);
  assert.equal(lines.filter(x=>x.startsWith('restore ')).length,0);
  assert.equal(lines.filter(x=>x.startsWith('rm ')).length,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('S51 rejects invalid PostgreSQL archive TOC before remote upload', async () => {
 const {dir,env}=fixture(false,false,false,false,true);
 try {
  await assert.rejects(runSyntheticDrill(env,{socketCheck:()=>true}),/Docker operation failed/);
  const lines=readFileSync(join(dir,'calls.log'),'utf8').trim().split('\n');
  assert.equal(lines.filter(x=>x==='archive-list').length,1);
  assert.equal(lines.filter(x=>x==='remote-upload').length,0);
  assert.equal(lines.filter(x=>x.startsWith('restore ')).length,0);
  assert.equal(lines.filter(x=>x.startsWith('rm ')).length,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
