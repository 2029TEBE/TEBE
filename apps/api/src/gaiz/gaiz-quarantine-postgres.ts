import { createHash, randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { auditEvents, withTenant } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';

const MAX_ARTIFACT = 8 * 1024 * 1024;
const MAX_ACTIVE_JOBS = 100;
const MAX_ACTIVE_BYTES = 256 * 1024 * 1024;
const IDEMPOTENCY = /^[A-Za-z0-9_-]{16,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAGIC = Buffer.from('GAIZ1\n', 'ascii');
const rows = (result: unknown) => result as unknown as any[];

/**
 * Experimental, UNREGISTERED disposable-DB quarantine store.
 * Holds untrusted ciphertext only; never plaintext, DEKs or bearer tokens.
 *
 * This class MUST NOT be registered in any active module until its schema,
 * app-role privileges, storage encryption, retention and RLS tests are approved.
 * It does not verify an issuer, decrypt a payload or grant import permission.
 */
@Injectable()
export class GaizQuarantinePostgres {
  async claim(bytes: Uint8Array, idempotencyKey: string) {
    if (process.env.NODE_ENV === 'production' ||
        process.env.GAIZ_DEV_ONLY !== 'true') {
      throw new ServiceUnavailableException('GAIZ quarantine is not enabled');
    }
    const ctx = currentContext();
    if (!ctx.userId || !UUID.test(ctx.userId) || !UUID.test(ctx.tenantId)) {
      throw new ForbiddenException('Authenticated workspace required');
    }
    requireCapability('pmoa_manage_projects');
    if (!(bytes instanceof Uint8Array) || bytes.byteLength <= MAGIC.length ||
        bytes.byteLength > MAX_ARTIFACT ||
        !Buffer.from(bytes.subarray(0, MAGIC.length)).equals(MAGIC) ||
        !IDEMPOTENCY.test(idempotencyKey)) {
      throw new ConflictException('Invalid GAIZ quarantine request');
    }

    const tenantId = ctx.tenantId;
    const actorId = ctx.userId;
    // Explicit copy prevents caller mutation of a request buffer between
    // calculating the digest and committing the same bytes to PostgreSQL.
    const ciphertext = Buffer.from(bytes);
    const envelopeSha256 = createHash('sha256').update(ciphertext).digest('hex');

    return withTenant(tenantId, async (tx) => {
      // Advisory lock serializes quota and idempotency claims per tenant.
      // It is not an authorization boundary; RLS and membership checks are.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('gaiz-quarantine:' || ${tenantId}))`);
      const [member] = rows(await tx.execute(sql`
        SELECT m.id FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.tenant_id = ${tenantId} AND m.user_id = ${actorId}
          AND m.is_active = true AND u.is_active = true
        FOR SHARE OF m
      `));
      if (!member) throw new ForbiddenException('Active workspace membership required');

      const [previous] = rows(await tx.execute(sql`
        SELECT id, requested_by AS "requestedBy",
               envelope_sha256 AS "envelopeSha256",
               content_length AS "contentLength",
               expires_at AS "expiresAt",
               state
        FROM gaiz_quarantine_blobs
        WHERE tenant_id = ${tenantId} AND idempotency_key = ${idempotencyKey}
        FOR UPDATE
      `));
      if (previous) {
        if (previous.requestedBy !== actorId ||
            previous.envelopeSha256 !== envelopeSha256 ||
            previous.contentLength !== ciphertext.byteLength ||
            previous.state === 'expired' || new Date(previous.expiresAt).getTime() <= Date.now()) {
          throw new ConflictException('Idempotency key already claimed');
        }
        return Object.freeze({
          id: previous.id,
          envelopeSha256,
          bytesLength: ciphertext.byteLength,
          state: previous.state,
          replayed: true,
          importAllowed: false,
        });
      }

      const [usage] = rows(await tx.execute(sql`
        SELECT count(*)::int AS "activeJobs",
               COALESCE(sum(content_length), 0)::bigint AS "activeBytes"
        FROM gaiz_quarantine_blobs
        WHERE tenant_id = ${tenantId} AND expires_at > now()
      `));
      const activeJobs = Number(usage?.activeJobs);
      const activeBytes = Number(usage?.activeBytes);
      if (!Number.isSafeInteger(activeJobs) || !Number.isSafeInteger(activeBytes) ||
          activeJobs >= MAX_ACTIVE_JOBS ||
          activeBytes + ciphertext.byteLength > MAX_ACTIVE_BYTES) {
        throw new ConflictException('GAIZ quarantine quota exceeded');
      }

      const id = randomUUID();
      const [inserted] = rows(await tx.execute(sql`
        INSERT INTO gaiz_quarantine_blobs (
          id, tenant_id, requested_by, idempotency_key,
          envelope_sha256, envelope_bytes, content_length
        ) VALUES (
          ${id}, ${tenantId}, ${actorId}, ${idempotencyKey},
          ${envelopeSha256}, ${ciphertext}, ${ciphertext.byteLength}
        )
        ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
        RETURNING id, state
      `));
      // An out-of-band writer must not silently invalidate the idempotency
      // claim. Throw to roll back instead of creating a duplicate receipt.
      if (!inserted) throw new ConflictException('Concurrent GAIZ claim rejected');

      await tx.insert(auditEvents).values({
        tenantId, actorId, entity: 'gaiz_quarantine_blob', entityId: id,
        action: 'gaiz.quarantined',
        diff: { sha256: envelopeSha256, bytesLength: ciphertext.byteLength },
      });
      return Object.freeze({
        id,
        envelopeSha256,
        bytesLength: ciphertext.byteLength,
        state: 'quarantined',
        replayed: false,
        importAllowed: false,
      });
    });
  }
}
