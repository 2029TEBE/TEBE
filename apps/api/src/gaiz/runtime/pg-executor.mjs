// Internal server runtime; transaction() is bound by the host to its own DB.
// No callback, key, principal, trust record or SQL may come from HTTP JSON.
import {approvedPatchDigest} from './approved-patch.mjs';
import {randomUUID,createPublicKey,createHash} from 'node:crypto';
import {digest,verifyEnvelope,signEnvelope} from './protocol.mjs';
import {fingerprintGaizTarget} from '../gaiz-import-authorization.mjs';
const deny=()=>{throw Error('GAIZ execution denied')};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function context(c){if(!c||!UUID.test(c.tenantId)||!UUID.test(c.userId)||!c.capabilities?.includes('pmoa_admin'))deny();}
const query=async(tx,text,args=[])=>{const r=await tx.query(text,args);return r.rows;};
const first=async(tx,text,args)=>(await query(tx,text,args))[0];
function expiry(x){const n=new Date(x).getTime();if(!Number.isFinite(n))deny();return n;}
function live(r,now){if(!r||r.status!=='approved'||expiry(r.expires_at)<=now||!r.approved_by||r.approved_by===r.requested_by)deny();}
async function lockRecords(tx,tenant,id,now){
 const a=await first(tx,'SELECT * FROM public.gaiz_import_authorizations WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenant,id]);live(a,now);
 const stage=await first(tx,'SELECT * FROM public.gaiz_import_requests WHERE tenant_id=$1 AND id=$2 FOR SHARE',[tenant,a.staging_review_id]);
 if(!stage||stage.status!=='approved'||!stage.reviewed_by||stage.reviewed_by===stage.requested_by||a.approved_by===stage.requested_by||expiry(stage.expires_at)<=now)deny();
 const custody=await first(tx,'SELECT * FROM public.gaiz_custody_attempts WHERE tenant_id=$1 AND id=$2 FOR SHARE',[tenant,a.custody_attempt_id]);
 if(!custody||custody.status!=='validated'||custody.review_id!==stage.id||custody.artifact_sha256!==stage.sha256||!custody.report_sha256)deny();
 const profile=await first(tx,'SELECT * FROM public.gaiz_mapping_profiles WHERE tenant_id=$1 AND profile_id=$2 AND target_kind=$3 FOR SHARE',[tenant,a.mapping_profile_id,a.target_kind]);
 const field=a.target_kind==='project'?'project.name':a.target_kind==='portfolio'?'portfolio.description':null;
 if(!field||!profile||profile.status!=='approved'||!profile.reviewed_by||profile.reviewed_by===profile.requested_by||JSON.stringify(profile.field_mappings)!==JSON.stringify([field]))deny();
 // Two fixed statements: no dynamic table/column from a request.
 const target=await first(tx,a.target_kind==='project'?
  'SELECT id,tenant_id,revision,name FROM public.projects WHERE tenant_id=$1 AND id=$2 FOR UPDATE':
  'SELECT id,tenant_id,revision,description FROM public.portfolios WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenant,a.target_id]);
 if(!target)deny();
 const snapshot={id:target.id,tenantId:target.tenant_id,kind:a.target_kind,revision:target.revision,fields:a.target_kind==='project'?{name:target.name}:{description:target.description}};
 if(fingerprintGaizTarget(snapshot)!==a.target_snapshot_sha256)deny();
 return {a,stage,custody,profile,snapshot};
}
async function trust(tx,tenant,kind,id,now){
 const r=await first(tx,'SELECT * FROM public.gaiz_lock_trust_key($1,$2,$3)',[tenant,kind,id]);
 if(!r||r.status!=='active'||!r.approved_by||r.approved_by===r.registered_by||r.revoked_at||expiry(r.valid_from)>now||expiry(r.valid_until)<=now)deny();
 const pub=createPublicKey(r.public_key_pem);
 if(pub.asymmetricKeyType!==(kind==='recipient'?'rsa':'ed25519')||(kind==='recipient'&&(pub.asymmetricKeyDetails?.modulusLength??0)<3072)||createHash('sha256').update(pub.export({type:'spki',format:'der'})).digest('hex')!==r.public_key_sha256)deny();
 return {...r,publicKey:pub};
}
async function trustSet(tx,tenant,{issuerId,recipientKeyId,custodianId},now){
 const issuer=await trust(tx,tenant,'issuer',issuerId,now),recipient=await trust(tx,tenant,'recipient',recipientKeyId,now),custodian=await trust(tx,tenant,'custodian',custodianId,now);
 if(issuer.public_key_sha256===custodian.public_key_sha256)deny();
 if(recipient.owner_type==='platform'){
  const c=await first(tx,"SELECT * FROM public.gaiz_lock_recovery_consent($1,$2,$3)",[tenant,recipientKeyId,new Date(now)]);
  if(!c||c.purpose!=='approved-field-import'||!c.approved_by||c.approved_by===c.requested_by)deny();
 }
 return {issuer,recipient,custodian};
}
export function createPgGaizExecutor({transaction,grantPublicKey,signGrant,clock=Date.now}={}){
 if(typeof transaction!=='function'||!grantPublicKey||typeof signGrant!=='function')deny();
 return Object.freeze({
  async issue(contextFromSession,{authorizationId,custodianId}={}){
   context(contextFromSession);if(!UUID.test(authorizationId))deny();
   return transaction(contextFromSession.tenantId,async tx=>{
    const now=clock(),tenant=contextFromSession.tenantId;
    const {a,stage,custody,snapshot}=await lockRecords(tx,tenant,authorizationId,now);
    const identities={issuerId:stage.issuer_id,recipientKeyId:custody.recipient_key_id,custodianId};
    await trustSet(tx,tenant,identities,now);
    const expires=Math.min(now+300000,expiry(a.expires_at),expiry(stage.expires_at));
    const grant={protocol:'gaiz-execution/1',purpose:'approved-field-import',tenantId:tenant,actorId:contextFromSession.userId,authorizationId:a.id,stagingReviewId:stage.id,custodyAttemptId:custody.id,artifactSha256:stage.sha256,reportSha256:custody.report_sha256,...identities,targetKind:a.target_kind,targetId:a.target_id,revision:snapshot.revision,targetSnapshotSha256:a.target_snapshot_sha256,mappingProfileId:a.mapping_profile_id,previewSha256:a.preview_sha256,nonce:randomUUID(),issuedAt:new Date(now).toISOString(),expiresAt:new Date(expires).toISOString()};
    const envelope=await signEnvelope('grant',grant,signGrant);verifyEnvelope('grant',envelope,grantPublicKey,clock());
    await query(tx,'INSERT INTO public.gaiz_execution_grants(id,tenant_id,authorization_id,grant_sha256,envelope,expires_at) VALUES($1,$2,$3,$4,$5,$6)',[grant.nonce,tenant,a.id,digest(grant),JSON.stringify(envelope),new Date(expires)]);
    await query(tx,"INSERT INTO public.audit_events(tenant_id,actor_id,entity,entity_id,action,diff) VALUES($1,$2,'gaiz_execution',$3,'gaiz.execution.issued',$4)",[tenant,contextFromSession.userId,a.id,JSON.stringify({grantSha256:digest(grant)})]);
    return {grant:envelope,snapshot};
   });
  },
  async commit(contextFromSession,envelope){
   context(contextFromSession);
   // Bounded untrusted routing hints only; every value is rebound under locks.
   if(Buffer.byteLength(JSON.stringify(envelope)??'')>65536)deny();
   const hint=envelope?.payload?.grant;if(!hint||!UUID.test(hint.nonce)||hint.tenantId!==contextFromSession.tenantId)deny();
   return transaction(contextFromSession.tenantId,async tx=>{
    const now=clock(),tenant=contextFromSession.tenantId;
    // Lock order is identical to issuance: authorization, source, profile, target, grant.
    const {a,stage,custody,snapshot,profile}=await lockRecords(tx,tenant,hint.authorizationId,now);
    const stored=await first(tx,'SELECT * FROM public.gaiz_execution_grants WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenant,hint.nonce]);
    if(!stored||stored.state!=='issued'||stored.authorization_id!==a.id||expiry(stored.expires_at)<=now)deny();
    const grant=verifyEnvelope('grant',stored.envelope,grantPublicKey,now);
    if(digest(hint)!==stored.grant_sha256||digest(grant)!==stored.grant_sha256||grant.actorId!==contextFromSession.userId||grant.authorizationId!==a.id||grant.stagingReviewId!==stage.id||grant.custodyAttemptId!==custody.id||grant.artifactSha256!==stage.sha256||grant.reportSha256!==custody.report_sha256||grant.issuerId!==stage.issuer_id||grant.recipientKeyId!==custody.recipient_key_id||grant.targetId!==a.target_id||grant.targetKind!==a.target_kind||grant.mappingProfileId!==profile.profile_id||grant.previewSha256!==a.preview_sha256||grant.targetSnapshotSha256!==fingerprintGaizTarget(snapshot)||grant.revision!==snapshot.revision)deny();
    const trusted=await trustSet(tx,tenant,grant,now);
    const result=verifyEnvelope('result',envelope,trusted.custodian.publicKey,now);
    if(result.grantSha256!==stored.grant_sha256)deny();
    // Digest/preview was computed over the FULL report inside the custodian.
    // The independent signed result carries only one allowlisted field.
    const current=clock();
    verifyEnvelope('result',envelope,trusted.custodian.publicKey,current);
    live(a,current);if(expiry(stage.expires_at)<=current)deny();
    for(const record of Object.values(trusted))if(expiry(record.valid_until)<=current)deny();
    const patch=result.patch;
    if(approvedPatchDigest(grant,snapshot,patch)!==a.preview_sha256)deny();
    const update=await query(tx,grant.targetKind==='project'?
     'UPDATE public.projects SET name=$1 WHERE tenant_id=$2 AND id=$3 AND revision=$4 RETURNING revision':
     'UPDATE public.portfolios SET description=$1 WHERE tenant_id=$2 AND id=$3 AND revision=$4 RETURNING revision',[patch.value,tenant,grant.targetId,grant.revision]);
    if(update.length!==1||update[0].revision!==grant.revision+1)deny();
    const consumed=await query(tx,"UPDATE public.gaiz_execution_grants SET state='consumed',consumed_at=$1,result_sha256=$2 WHERE tenant_id=$3 AND id=$4 AND state='issued' RETURNING id",[new Date(now),digest(result),tenant,grant.nonce]);
    if(consumed.length!==1)deny();
    await query(tx,"INSERT INTO public.audit_events(tenant_id,actor_id,entity,entity_id,action,diff) VALUES($1,$2,'gaiz_import',$3,'gaiz.import.committed',$4)",[tenant,contextFromSession.userId,grant.targetId,JSON.stringify({authorizationId:a.id,grantSha256:stored.grant_sha256,artifactSha256:grant.artifactSha256,reportSha256:grant.reportSha256,field:patch.field,valueSha256:createHash('sha256').update(patch.value).digest('hex'),fromRevision:grant.revision,toRevision:update[0].revision})]);
    return {status:'committed',authorizationId:a.id,targetId:grant.targetId,revision:update[0].revision};
   });
  },
 });
}

/** TEBE-owned registry adapter. TO sees only the selected public policy and
 * opaque Vault references, never a database handle or tenant data query port. */
export function createPgGaizPolicyStore({transaction,custodyRoutes,clock=Date.now}={}){
 if(typeof transaction!=='function'||!custodyRoutes||Object.getPrototypeOf(custodyRoutes)!==Object.prototype)deny();
 // Copy server-owned routes so request handlers cannot mutate them later.
 const routes=structuredClone(custodyRoutes);
 return Object.freeze({async load({tenantId,issuerId,recipientKeyId,custodianId}){
  if(!UUID.test(tenantId))deny();
  return transaction(tenantId,async tx=>{
   const records=await trustSet(tx,tenantId,{issuerId,recipientKeyId,custodianId},clock());
   function convert(r){
    const out={keyId:r.key_id,tenantId:r.tenant_id,algorithm:r.algorithm,ownerType:r.owner_type,status:r.status,validFrom:new Date(r.valid_from).toISOString(),validUntil:new Date(r.valid_until).toISOString(),publicKeyPem:r.public_key_pem,spkiSha256:r.public_key_sha256};
    if(r.key_kind!=='issuer'){
     const route=routes[tenantId]?.[r.key_id];
     if(!route||route.spkiSha256!==r.public_key_sha256)deny();out.custodyRef=structuredClone(route);
    }
    return out;
   }
   const result={issuer:convert(records.issuer),recipient:convert(records.recipient),custodian:convert(records.custodian)};
   if(records.recipient.owner_type==='platform'){
    const c=await first(tx,'SELECT * FROM public.gaiz_lock_recovery_consent($1,$2,$3)',[tenantId,recipientKeyId,new Date(clock())]);
    if(!c)deny();result.consent={tenantId,status:c.status,recipientKeyId:c.recipient_key_id,purpose:c.purpose,requestedBy:c.requested_by,approvedBy:c.approved_by,expiresAt:new Date(c.expires_at).toISOString()};
   }
   return result;
  });
 }});
}
