// Trusted-default-branch policy, never execute code from the PR being merged.
export function canAutoMerge(pr,checks,{repository,base='main',required=['Dependency-free source checks','verify','audit']}={}){
 if(!pr||pr.isDraft!==false||pr.headRepository?.nameWithOwner!==repository||pr.baseRefName!==base||pr.mergeable!=='MERGEABLE'||!['',null,undefined,'APPROVED'].includes(pr.reviewDecision)||!/^[a-f0-9]{40}$/.test(pr.headRefOid??''))return false;
 if(!Array.isArray(pr.labels)||pr.labels.some(x=>['hold','do-not-merge'].includes(x.name))||!Array.isArray(checks)||!checks.length)return false;
 if(!required.every(name=>checks.some(c=>c.name===name&&c.state==='SUCCESS')))return false;
 return checks.every(c=>['SUCCESS','SKIPPED','NEUTRAL'].includes(c.state));
}
