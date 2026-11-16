import {execFileSync} from 'node:child_process';
import {canAutoMerge} from './auto-merge-policy.mjs';
const repository=process.env.GH_REPO,base=process.env.BASE||'main';
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository??'')||!/^[-A-Za-z0-9_./]+$/.test(base))throw Error('Explicit repository and branch required');
function gh(args){return JSON.parse(execFileSync('gh',args,{encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}));}
const prs=gh(['pr','list','--repo',repository,'--base',base,'--state','open','--limit','100','--json','number,isDraft']);
for(const item of prs){
 if(item.isDraft||!Number.isSafeInteger(item.number))continue;
 try{
  const pr=gh(['pr','view',String(item.number),'--repo',repository,'--json','isDraft,headRepository,baseRefName,headRefOid,mergeable,reviewDecision,labels']);
  const checks=gh(['pr','checks',String(item.number),'--repo',repository,'--json','name,state']);
  if(!canAutoMerge(pr,checks,{repository,base}))continue;
  execFileSync('gh',['pr','merge',String(item.number),'--repo',repository,'--match-head-commit',pr.headRefOid,'--squash','--delete-branch'],{stdio:'inherit'});
 }catch{console.log(`PR ${item.number} remains open: checks, review or GitHub merge rules not satisfied.`);}
}
