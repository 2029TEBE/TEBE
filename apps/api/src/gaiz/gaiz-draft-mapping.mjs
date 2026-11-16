/**
 * Pure, inert GAIZ-to-TEBE draft proposal mapper.
 * This does not create records; verified and decrypted content, authenticated
 * authorization, persisted approval and transactional object creation are
 * independent prerequisites. No supplied status/SQL/HTML is forwarded.
 */
const deny=()=>{throw new Error('GAIZ mapping rejected')};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/;
const safeText=(v,max)=>typeof v==='string' && v.trim().length>0 &&
  v.length<=max && !/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);

export function planSyntheticGaizGovernanceDraft(content, evidence) {
  if(!content || Array.isArray(content) || typeof content!=='object' ||
      !evidence || typeof evidence!=='object' ||
      !UUID.test(evidence.tenantId??'') || !UUID.test(evidence.workspaceId??'') ||
      evidence.tenantId!==evidence.workspaceId ||
      !UUID.test(evidence.quarantineId??'') ||
      !HASH.test(evidence.envelopeSha256??'') ||
      !safeText(evidence.artifactId,256) || !safeText(evidence.issuerKeyId,128) ||
      evidence.signatureValid!==true || evidence.aeadValid!==true ||
      evidence.schemaMapped!==true || evidence.entitled!==true ||
      content.schemaVersion!==1 ||
      !safeText(content.title,200) || !safeText(content.summary,5000) ||
      Object.keys(content).sort().join(',')!=='schemaVersion,summary,title')deny();

  // Proposal only; project creation, approval state, and actor identity are
  // forbidden in this output. The eventual executor must use existing
  // TEBE business services under the same RLS-scoped transaction as audit.
  return Object.freeze({
    targetType:'governance_report_draft',
    tenantId:evidence.tenantId,
    source:Object.freeze({
      artifactId:evidence.artifactId,
      issuerKeyId:evidence.issuerKeyId,
      quarantineId:evidence.quarantineId,
      envelopeSha256:evidence.envelopeSha256,
    }),
    fields:Object.freeze({
      title:content.title.trim(),
      summary:content.summary.trim(),
    }),
    executable:false,
    requiresHumanApproval:true,
  });
}
