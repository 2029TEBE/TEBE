import test from 'node:test';
import assert from 'node:assert/strict';
import {canAutoMerge} from './auto-merge-policy.mjs';
const options={repository:'2029TEBE/TEBE'};
const pr={isDraft:false,headRepository:{nameWithOwner:options.repository},baseRefName:'main',headRefOid:'a'.repeat(40),mergeable:'MERGEABLE',reviewDecision:'APPROVED',author:{login:'2029TEBE'},labels:[]};
const checks=['Dependency-free source checks','verify','audit'].map(name=>({name,state:'SUCCESS'}));
const approvals=[{id:10,state:'APPROVED',commit_id:pr.headRefOid,user:{login:'security-reviewer'}}];
const allowed=(candidate=pr,candidateChecks=checks,reviews=approvals)=>canAutoMerge(candidate,candidateChecks,options,reviews);
test('ready same-repository PR can merge only after all required checks actually succeed',()=>assert.equal(allowed(),true));
test('skipped or missing required checks, drafts, forks, holds, conflicts and required reviews block',()=>{
 for(const state of ['SKIPPED','NEUTRAL','PENDING','FAILURE'])assert.equal(allowed(pr,[{name:'verify',state},...checks.filter(c=>c.name!=='verify')]),false);
 assert.equal(allowed(pr,checks.slice(1)),false);
 for(const patch of [{isDraft:true},{headRepository:{nameWithOwner:'fork/repo'}},{baseRefName:'release'},{labels:[{name:'hold'}]},{mergeable:'CONFLICTING'},{reviewDecision:'CHANGES_REQUESTED'},{reviewDecision:'REVIEW_REQUIRED'}])assert.equal(allowed({...pr,...patch}),false);
});

test('no review, missing review decision, self approval or stale commit blocks auto-merge',()=>{
 for(const decision of ['',null,undefined,'REVIEW_REQUIRED','CHANGES_REQUESTED'])
  assert.equal(allowed({...pr,reviewDecision:decision}),false);
 assert.equal(allowed(pr,checks,[]),false);
 assert.equal(allowed(pr,checks,[{...approvals[0],user:{login:pr.author.login}}]),false);
 assert.equal(allowed(pr,checks,[{...approvals[0],commit_id:'b'.repeat(40)}]),false);
 assert.equal(allowed({...pr,author:null}),false);
});
test('latest review event from a reviewer must be an approval for current head',()=>{
 assert.equal(allowed(pr,checks,[...approvals,{id:11,state:'CHANGES_REQUESTED',commit_id:pr.headRefOid,user:{login:'security-reviewer'}}]),false);
 assert.equal(allowed(pr,checks,[...approvals,{id:11,state:'DISMISSED',commit_id:pr.headRefOid,user:{login:'security-reviewer'}}]),false);
 assert.equal(allowed(pr,checks,[{...approvals[0],id:20},{...approvals[0],id:10,state:'COMMENTED'}]),true);
});
