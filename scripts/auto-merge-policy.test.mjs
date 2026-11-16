import test from 'node:test';
import assert from 'node:assert/strict';
import {canAutoMerge} from './auto-merge-policy.mjs';
const options={repository:'2029TEBE/TEBE'};
const pr={isDraft:false,headRepository:{nameWithOwner:options.repository},baseRefName:'main',headRefOid:'a'.repeat(40),mergeable:'MERGEABLE',reviewDecision:'',labels:[]};
const checks=['Dependency-free source checks','verify','audit'].map(name=>({name,state:'SUCCESS'}));
test('ready same-repository PR can merge only after all required checks actually succeed',()=>assert.equal(canAutoMerge(pr,checks,options),true));
test('skipped or missing required checks, drafts, forks, holds, conflicts and required reviews block',()=>{
 for(const state of ['SKIPPED','NEUTRAL','PENDING','FAILURE'])assert.equal(canAutoMerge(pr,[{name:'verify',state},...checks.filter(c=>c.name!=='verify')],options),false);
 assert.equal(canAutoMerge(pr,checks.slice(1),options),false);
 for(const patch of [{isDraft:true},{headRepository:{nameWithOwner:'fork/repo'}},{baseRefName:'release'},{labels:[{name:'hold'}]},{mergeable:'CONFLICTING'},{reviewDecision:'CHANGES_REQUESTED'},{reviewDecision:'REVIEW_REQUIRED'}])assert.equal(canAutoMerge({...pr,...patch},checks,options),false);
});
