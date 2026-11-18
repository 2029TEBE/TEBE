// GAIZ encrypted, host-local private object store (source-only, unmounted).
// Suitable for a single-host staging backend only after operator has provided
// a protected storage mount, a 256-bit encryption key and backup/key rotation.
// No public URLs, static mounts, S3 credentials or HTTP routes are created.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, lstat } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';

const fail = () => { throw Error('GAIZ encrypted private object unavailable'); };
const MAGIC = Buffer.from('GAIZOBJ1', 'ascii');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const OVERHEAD = MAGIC.length + IV_BYTES + TAG_BYTES;
const CONTENT_TYPES = new Set(['application/pdf','application/octet-stream','text/html; charset=utf-8']);
const OBJECT_KEY = /^orgaiz\/private\/staging\/[a-f0-9]{64}$/;
const DIGEST = /^[a-f0-9]{64}$/;

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function objectPath(root, objectKey) {
  if (typeof objectKey !== 'string' || !OBJECT_KEY.test(objectKey)) fail();
  // File name only, never a client-controlled or absolute path.
  return join(root, objectKey.slice('orgaiz/private/staging/'.length) + '.genc');
}
function validateRoot(root) {
  if (typeof root !== 'string' || !isAbsolute(root) || resolve(root) !== root ||
      root.includes('\0') || root === sep) fail();
  return root;
}
function validateSecret(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) fail();
  return Buffer.from(key); // Do not mutate caller's key.
}
async function assertPrivateDirectory(root) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const s = await lstat(root);
  if (!s.isDirectory() || s.isSymbolicLink() || (s.mode & 0o077) !== 0) fail();
}
export function createGaizEncryptedFileObjectStore({
  enabled = false, rootDirectory, encryptionKey, maxBytes = 10_000_000
} = {}) {
  if (enabled !== true || !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1024 || maxBytes > 10_000_000) fail();
  const root = validateRoot(rootDirectory);
  const key = validateSecret(encryptionKey);
  return Object.freeze({
    async putEncrypted({ objectKey, bytes, contentType, immutable, public: isPublic } = {}) {
      if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > maxBytes ||
          !CONTENT_TYPES.has(contentType) || immutable !== true || isPublic !== false) fail();
      const path = objectPath(root, objectKey);
      await assertPrivateDirectory(root);
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(objectKey, 'utf8'));
      const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
      const tag = cipher.getAuthTag();
      const blob = Buffer.concat([MAGIC, iv, tag, encrypted]);
      let fh;
      try {
        fh = await open(path, constants.O_WRONLY | constants.O_CREAT |
          constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        await fh.writeFile(blob);
        await fh.sync();
      } catch { fail(); }
      finally { if (fh) await fh.close(); }
      // Caller commits the DB pointer only after a successful immutable write.
      return Object.freeze({ objectKey, encrypted: true, public: false,
        sha256: sha256(bytes), sizeBytes: bytes.length });
    },
    async getPrivate({ objectKey, maxBytes: requestedMax, allowPublic } = {}) {
      if (allowPublic !== false || !Number.isSafeInteger(requestedMax) ||
          requestedMax < 1 || requestedMax > maxBytes) fail();
      const path = objectPath(root, objectKey);
      await assertPrivateDirectory(root);
      let fh;
      try {
        fh = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        const stat = await fh.stat();
        if (!stat.isFile() || (stat.mode & 0o077) !== 0 ||
            stat.size <= OVERHEAD || stat.size > requestedMax + OVERHEAD) fail();
        const blob = await fh.readFile();
        if (blob.length !== stat.size || !blob.subarray(0, MAGIC.length).equals(MAGIC)) fail();
        const iv = blob.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
        const tag = blob.subarray(MAGIC.length + IV_BYTES, OVERHEAD);
        const cipherText = blob.subarray(OVERHEAD);
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAAD(Buffer.from(objectKey, 'utf8'));
        decipher.setAuthTag(tag);
        const bytes = Buffer.concat([decipher.update(cipherText), decipher.final()]);
        if (bytes.length < 1 || bytes.length > requestedMax) fail();
        return Object.freeze({ bytes });
      } catch { fail(); }
      finally { if (fh) await fh.close(); }
    }
  });
}
