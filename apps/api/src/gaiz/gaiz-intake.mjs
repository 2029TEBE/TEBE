/**
 * GAIZ candidate bounded quarantine intake policy.
 *
 * This prepares immutable metadata for a future transactionally persistent,
 * private object-store-backed quarantine. It does not store or publish bytes,
 * infer issuer trust or authorize imports.
 */
import { createHash, randomUUID } from 'node:crypto';

const MAGIC=Buffer.from('GAIZ1\n','ascii');
const MAX=8*1024*1024;
const HASH=/^[a-f0-9]{64}$/;
const ID=/^[a-zA-Z0-9_-]{16,128}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=()=>{throw new Error('GAIZ quarantine request rejected')};

export function prepareGaizQuarantine(bytes, {tenantId, actorId, idempotencyKey}={}) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength<=MAGIC.length || bytes.byteLength>MAX ||
      !Buffer.from(bytes.subarray(0,MAGIC.length)).equals(MAGIC) ||
      typeof tenantId!=='string' || !UUID.test(tenantId) ||
      typeof actorId!=='string' || !UUID.test(actorId) ||
      typeof idempotencyKey!=='string' || !ID.test(idempotencyKey)) fail();

  // Check exact byte hash; preserve bytes as ciphertext, never parse until
  // trusted issuer selection and strict verification in an isolated worker.
  const sha256=createHash('sha256').update(bytes).digest('hex');
  return Object.freeze({
    jobId:randomUUID(),
    tenantId,
    requestedBy:actorId,
    idempotencyKey,
    envelopeSha256:sha256,
    bytesLength:bytes.byteLength,
    state:'quarantined',
    verificationStatus:'pending',
    importAllowed:false,
    // No file bytes, signed claims, access URL or user-controlled MIME returned.
  });
}

/** Enforce idempotency collision semantics after a database UNIQUE claim. */
export function checkGaizIntakeCollision(existing, proposal) {
  if(!existing || !proposal || existing.tenantId!==proposal.tenantId ||
     existing.idempotencyKey!==proposal.idempotencyKey ||
     typeof existing.envelopeSha256!=='string' || !HASH.test(existing.envelopeSha256) ||
     typeof proposal.envelopeSha256!=='string' || !HASH.test(proposal.envelopeSha256)) fail();
  if(existing.envelopeSha256!==proposal.envelopeSha256 || !UUID.test(existing.jobId)) fail();
  return Object.freeze({replayed:true, jobId:existing.jobId, importAllowed:false});
}
