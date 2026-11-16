// Independent signed mapping-preview verifier. This attests metadata only.
// Caller MUST fetch expected values from tenant-RLS authoritative storage.
import {verify,createPublicKey} from 'node:crypto';
const DOMAIN='GAIZ2-MAPPING-PREVIEW\n';
const H=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS=['tenantId','stagingReviewId','artifactSha256','reportSha256',
 'targetId','targetKind','targetSnapshotSha256','revision','mappingProfileId',
 'previewSha256','custodianId','issuedAt','expiresAt','purpose'];
function bytes(p){
 if(!p||Object.getPrototypeOf(p)!==Object.prototype||
 Object.keys(p).sort().join('|')!==FIELDS.slice().sort().join('|'))throw Error('Wrong mapping claims');
 for(const k of ['tenantId','stagingReviewId','targetId'])
  if(typeof p[k]!=='string'||!UUID.test(p[k]))throw Error('Invalid mapping ID');
 for(const k of ['artifactSha256','reportSha256','targetSnapshotSha256','previewSha256'])
  if(typeof p[k]!=='string'||!H.test(p[k]))throw Error('Invalid mapping hash');
 for(const k of ['mappingProfileId','custodianId'])
  if(typeof p[k]!=='string'||!ID.test(p[k]))throw Error('Invalid mapping directory ID');
 if(!['project','portfolio'].includes(p.targetKind)||!Number.isSafeInteger(p.revision)||p.revision<0||
 p.purpose!=='metadata-preview-only')throw Error('Mapping purpose denied');
 const t=Date.parse(p.issuedAt),e=Date.parse(p.expiresAt);
 if(!Number.isFinite(t)||!Number.isFinite(e)||new Date(t).toISOString()!==p.issuedAt||
 new Date(e).toISOString()!==p.expiresAt||e<=t||e-t>300000)throw Error('Mapping time rejected');
 return Buffer.from(DOMAIN+JSON.stringify(Object.fromEntries(Object.keys(p).sort().map(k=>[k,p[k]]))));
}
/** Returns only a verified receipt indicator, NEVER a write authorization. */
export function verifyMappingPreviewReceipt(attestation,expect={}){
 const p=attestation?.payload;
 if(!expect.trustedCustodianPublicKey||typeof attestation?.signature!=='string'||
 !/^[A-Za-z0-9_-]+$/.test(attestation.signature))throw Error('Missing trusted custodian');
 const key=expect.trustedCustodianPublicKey.type==='public'?
  expect.trustedCustodianPublicKey:createPublicKey(expect.trustedCustodianPublicKey);
 const sig=Buffer.from(attestation.signature,'base64url');
 if(key.asymmetricKeyType!=='ed25519'||sig.length!==64||
 sig.toString('base64url')!==attestation.signature||
 !verify(null,bytes(p),key,sig))throw Error('Invalid mapping signature');
 for(const k of ['tenantId','stagingReviewId','artifactSha256','reportSha256',
 'targetId','targetKind','targetSnapshotSha256','revision','mappingProfileId',
 'previewSha256','custodianId'])
  if(p[k]!==expect[k])throw Error('Mapping receipt binding mismatch');
 const now=expect.now??Date.now();
 if(!Number.isFinite(now)||now<Date.parse(p.issuedAt)||now>=Date.parse(p.expiresAt))
  throw Error('Mapping attestation expired');
 return Object.freeze({status:'verified-mapping-metadata-only',tenantId:p.tenantId,
  targetId:p.targetId,revision:p.revision,previewSha256:p.previewSha256,
  importAllowed:false,appliesData:false,containsPlaintext:false});
}
