import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
test('a checked and independently approved merge batch dispatches main CI; pending checks do not merge or dispatch',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'epmo-merge-'));
 try{
 const script=`#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$MOCK_LOG"
case "$1 $2" in
 'pr list') echo '[{"number":1,"isDraft":false}]' ;;
 'pr view') echo '{"isDraft":false,"headRepository":{"nameWithOwner":"2029TEBE/TEBE"},"baseRefName":"main","headRefOid":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","mergeable":"MERGEABLE","reviewDecision":"APPROVED","author":{"login":"2029TEBE"},"labels":[]}' ;;
 'api repos/2029TEBE/TEBE/pulls/1/reviews?per_page=100&page=1') echo '[{"id":11,"state":"APPROVED","commit_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","user":{"login":"independent-reviewer"}}]' ;;
 'pr checks') printf '[{"name":"Dependency-free source checks","state":"SUCCESS"},{"name":"verify","state":"%s"},{"name":"audit","state":"SUCCESS"}]\\n' "$MOCK_STATE" ;;
 'pr merge') exit 0 ;;
 'workflow run') exit 0 ;;
 *) exit 1 ;;
esac
`;
 await writeFile(join(dir,'gh'),script,{mode:0o700});
 for(const state of ['SUCCESS','PENDING']){
  const log=join(dir,state);
  const result=spawnSync(process.execPath,[resolve('scripts/run-safe-auto-merge.mjs')],{env:{...process.env,PATH:dir+':'+process.env.PATH,GH_REPO:'2029TEBE/TEBE',BASE:'main',MOCK_STATE:state,MOCK_LOG:log},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const lines=(await readFile(log,'utf8')).trim().split('\n');
  if(state==='SUCCESS'){
   const merge=lines.findIndex(x=>x.startsWith('pr merge ')),dispatch=lines.findIndex(x=>x==='workflow run ci.yml --repo 2029TEBE/TEBE --ref main');
   assert.ok(merge>=0&&dispatch>merge);assert.match(lines[merge],/--match-head-commit a{40}/);
   assert.equal(lines.filter(x=>x.startsWith('workflow run ')).length,2);
   assert.ok(lines.some(x=>x==='workflow run retire-integrated-branches.yml --repo 2029TEBE/TEBE --ref main'));
  }else assert.ok(lines.every(x=>!x.startsWith('pr merge ')&&!x.startsWith('workflow run ')));
 }
 }finally{await rm(dir,{recursive:true,force:true});}
});
