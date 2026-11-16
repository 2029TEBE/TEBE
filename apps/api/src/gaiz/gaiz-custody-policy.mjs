// TEBE GAIZ2 custody eligibility: policy only, never a decryption provider.
// Inputs must originate from authenticated TEBE session + its tenant-scoped DB
// and independently managed key directory; never accept caller-supplied records.
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH=/^[a-f0-9]{64}$/;
const ident=(v,n)=>{if(typeof v!=='string'||!ID.test(v))throw Error('Invalid '+n);return v;};
const when=s=>{const n=Date.parse(s);if(typeof s!=='string'||!Number.isFinite(n)||new Date(n).toISOString()!==s)throw Error('Invalid custody timestamp');return n;};
export function evaluateTebeCustody({context,request,verification,recipient,consent,now=Date.now()}){
 if(!context||!ident(context.tenantId,'tenant')||!ident(context.userId,'user')||
    !Array.isArray(context.capabilities)||!context.capabilities.includes('pmoa_admin'))
    throw Error('Custody requires authenticated admin context');
 if(!request||request.tenantId!==context.tenantId||request.status!=='approved'||
    !ident(request.requestedBy,'requester')||!ident(request.reviewedBy,'reviewer')||
    request.requestedBy===request.reviewedBy||
    !HASH.test(request.sha256)||when(request.expiresAt)<=now)
    throw Error('Distinct unexpired tenant review required');
 if(!verification||verification.verified!==true||
    verification.tenantScope!==context.tenantId||
    verification.sha256!==request.sha256||verification.artifactId!==request.artifactId||
    verification.issuerId!==request.issuerId)
    throw Error('Artifact cryptographic receipt mismatch');
 if(!recipient||recipient.tenantScope!==context.tenantId||
    recipient.status!=='active'||recipient.algorithm!=='RSA-OAEP-SHA256'||
    !ident(recipient.keyId,'key')||
    when(recipient.activeFrom)>now||when(recipient.activeUntil)<=now)
    throw Error('Recipient key policy denied');
 if(recipient.ownerType==='platform'){
    if(!consent||consent.status!=='approved'||consent.tenantId!==context.tenantId||
       consent.keyId!==recipient.keyId||!ident(consent.consentId,'consent')||
       when(consent.expiresAt)<=now)
       throw Error('Customer-approved platform recovery consent required');
 }else if(recipient.ownerType!=='customer')throw Error('Custody owner denied');
 return Object.freeze({status:'awaiting-external-custodian',
   tenantId:context.tenantId,reviewId:request.id,sha256:request.sha256,
   keyId:recipient.keyId,actorId:context.userId,
   decryptAllowed:false,importAllowed:false,plaintextReleased:false});
}
