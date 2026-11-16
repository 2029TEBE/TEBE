// Independently recompute the approved preview from the locked old value and
// signed new value. A trusted signer alone cannot substitute a different patch.
import {createHash} from 'node:crypto';
import {digest,safePatch} from './protocol.mjs';
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
export function approvedPatchDigest(grant,snapshot,patch){
 safePatch(patch,grant.targetKind);
 const key=grant.targetKind==='project'?'name':'description';
 const source=grant.targetKind==='project'?'title':'summary';
 const old=snapshot.fields[key];
 if(old!==null&&typeof old!=='string')throw Error('Invalid locked old value');
 const proposal={targetField:patch.field,sourceField:'report.'+source,
  decision:old===patch.value?'no_change':'requires_manual_review',
  oldSha256:old===null?null:sha(old),proposedSha256:sha(patch.value),
  oldLength:old?.length??null,proposedLength:patch.value.length,
  expectedRevision:snapshot.revision,containsPlaintext:false};
 return digest({artifactSha256:grant.artifactSha256,reportSha256:grant.reportSha256,
  tenantId:grant.tenantId,profileId:grant.mappingProfileId,targetId:grant.targetId,
  revision:grant.revision,proposals:[proposal]});
}
