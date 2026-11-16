// Exercises the real transport script with an isolated fake SSH/Docker host.
// No network, credentials, database or running containers are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {imageRuntimeIdentity} from './ci-image-bundle.mjs';
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
test('tested-image deployment loads exact image IDs and never rebuilds or pulls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'epmo-transport-'));try{
  const bin=join(dir,'bin'),bundle=join(dir,'bundle'),log=join(dir,'commands');await mkdir(bin);await mkdir(bundle);
  const data=Buffer.from('synthetic CI bundle bytes, not a real docker archive');
  const api='sha256:'+'d'.repeat(64),web='sha256:'+'e'.repeat(64);
  const image=(id)=>({Id:id,Os:'linux',Architecture:'amd64',Config:{User:'pmo',Labels:{'org.opencontainers.image.revision':revision},Cmd:['node','server.js']},RootFS:{Type:'layers',Layers:['sha256:'+'f'.repeat(64)]}});
  const apiInspect=image('sha256:'+'d'.repeat(64)),webInspect=image('sha256:'+'e'.repeat(64));
  await writeFile(join(bundle,'images.tar.gz'),data);
  await writeFile(join(bundle,'manifest.json'),JSON.stringify({version:2,revision,runId:'123',repository:'2029TEBE/TEBE',archiveSha256:createHash('sha256').update(data).digest('hex'),images:{api:{id:api,tag:'epmo-api:ci',runtimeDigest:imageRuntimeIdentity(apiInspect).runtimeDigest},web:{id:web,tag:'epmo-web:ci',runtimeDigest:imageRuntimeIdentity(webInspect).runtimeDigest}}}));
  await writeFile(join(bin,'ssh'),`#!/usr/bin/env bash
set -euo pipefail
cmd="\${!#}"
printf '%s\\n' "$cmd" >> "$TEST_LOG"
case "$cmd" in
  'printf "%s" "$HOME"') echo /home/fixture ;;
  'docker image load') cat >/dev/null ;;
  *"docker image inspect 'epmo-api:ci'"*) echo "$TEST_API_INSPECT" ;;
  *"docker image inspect 'epmo-web:ci'"*) echo "$TEST_WEB_INSPECT" ;;
  *'{{.Id}}'*) if [[ "$cmd" == *"$TEST_API_ID"* ]]; then echo "$TEST_API_ID"; else echo "$TEST_WEB_ID"; fi ;;
  *'{{.Image}}'*) if [[ "$cmd" == *"'api'"* ]]; then echo "$TEST_API_ID"; else echo "$TEST_WEB_ID"; fi ;;
  *'backup-db.sh'*) echo 'PASS: verified pre-migration PostgreSQL backup: /backups/epmo-prod-fixture.dump' ;;
esac
`,{mode:0o700});
  await writeFile(join(bin,'rsync'),'#!/bin/sh\nexit 0\n',{mode:0o700});
  const env={...process.env,PATH:bin+':'+process.env.PATH,EPMO_DEPLOY_HOST:'fixture@invalid.example',EPMO_TESTED_IMAGE_DIR:bundle,EPMO_CI_VERIFIED_SHA:revision,EPMO_CI_WORKFLOW_RUN_ID:'123',GITHUB_REPOSITORY:'2029TEBE/TEBE',GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_run',EPMO_RELEASE_API_IMAGE:'',EPMO_RELEASE_WEB_IMAGE:'',TEST_LOG:log,TEST_REVISION:revision,TEST_API_ID:apiInspect.Id,TEST_WEB_ID:webInspect.Id,TEST_API_INSPECT:JSON.stringify([apiInspect]),TEST_WEB_INSPECT:JSON.stringify([webInspect])};
  const run=spawnSync('bash',['infra/deploy.sh','prod'],{env,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
  const commands=await readFile(log,'utf8');assert.match(commands,/docker image load/);assert.ok(commands.indexOf('docker builder prune --all --force')<commands.indexOf('docker image load'));assert.doesNotMatch(commands,/docker (?:image|container|volume|system) prune/);assert.doesNotMatch(commands,/compose[^\n]*(?: build | pull )/);assert.match(commands,/--no-build --pull never/);assert.ok(commands.indexOf('docker image load')<commands.indexOf('backup-db.sh'));assert.match(commands,/bootstrap-db.sh/);assert.match(commands,/\{\{.Image\}\}/);
  await rm(log);
  const changed={...apiInspect,Id:'sha256:'+'9'.repeat(64),Config:{...apiInspect.Config,Cmd:['sh']}};
  const wrong=spawnSync('bash',['infra/deploy.sh','prod'],{env:{...env,TEST_API_INSPECT:JSON.stringify([changed])},encoding:'utf8',timeout:30000});
  assert.notEqual(wrong.status,0);assert.match(wrong.stderr,/image ID mismatch for api/);assert.doesNotMatch(await readFile(log,'utf8'),/backup-db.sh|bootstrap-db.sh/);
  await rm(log);await writeFile(join(bundle,'images.tar.gz'),Buffer.from('tampered'));
  const failed=spawnSync('bash',['infra/deploy.sh','prod'],{env,encoding:'utf8',timeout:30000});assert.notEqual(failed.status,0);await assert.rejects(readFile(log));
 }finally{await rm(dir,{recursive:true,force:true});}
});
