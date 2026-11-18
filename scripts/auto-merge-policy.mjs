// Trusted-default-branch policy, never execute code from the PR being merged.
export function canAutoMerge(pr,checks,{repository,base='main',required=['Dependency-free source checks','verify','audit']}={},reviews=[]){
 if(!pr||pr.isDraft!==false||pr.headRepository?.nameWithOwner!==repository||pr.baseRefName!==base||pr.mergeable!=='MERGEABLE'||pr.reviewDecision!=='APPROVED'||!pr.author?.login||!/^[a-f0-9]{40}$/.test(pr.headRefOid??''))return false;
 if(!Array.isArray(pr.labels)||pr.labels.some(x=>['hold','do-not-merge'].includes(x.name))||!Array.isArray(checks)||!checks.length)return false;
 if(!required.every(name=>checks.some(c=>c.name===name&&c.state==='SUCCESS')))return false;
 if(!checks.every(c=>['SUCCESS','SKIPPED','NEUTRAL'].includes(c.state)))return false;
 // Review decisions without branch rules can remain APPROVED after later pushes.
 // Require an independent, submitted approval for this exact commit.
 if(!Array.isArray(reviews)||reviews.length===0)return false;
 const latest=new Map();
 for(const review of reviews){
  const login=review?.user?.login;
  if(typeof login!=='string'||!Number.isSafeInteger(review?.id))continue;
  const prior=latest.get(login);
  if(!prior||review.id>prior.id)latest.set(login,review);
 }
 return [...latest.values()].some(review=>
  review.state==='APPROVED'&&review.commit_id===pr.headRefOid&&
  review.user.login!==pr.author.login
 );
}
