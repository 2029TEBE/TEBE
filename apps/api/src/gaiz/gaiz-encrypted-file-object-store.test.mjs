import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, chmod, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createGaizEncryptedFileObjectStore } from './gaiz-encrypted-file-object-store.mjs';
const objectKey = 'orgaiz/private/staging/' + 'a'.repeat(64);
async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'gaiz-private-'));
  try {
    await chmod(root, 0o700);
    return await fn({ root, key: randomBytes(32) });
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('default disabled and missing key cannot open private store', () => {
  assert.throws(() => createGaizEncryptedFileObjectStore());
  assert.throws(() => createGaizEncryptedFileObjectStore({enabled:true,rootDirectory:'/tmp/storage',encryptionKey:Buffer.alloc(16)}));
});
test('encrypted file round trip is not plaintext, immutable and private', async () => fixture(async ({root,key}) => {
  const storage = createGaizEncryptedFileObjectStore({enabled:true,rootDirectory:root,encryptionKey:key});
  const bytes = Buffer.from('<h1>Private GAIZ Report</h1>');
  const result = await storage.putEncrypted({objectKey,bytes,contentType:'text/html; charset=utf-8',immutable:true,public:false});
  assert.equal(result.encrypted,true);
  assert.equal(result.public,false);
  const encrypted = await readFile(join(root,'a'.repeat(64)+'.genc'));
  assert.equal(encrypted.includes(bytes),false);
  const read = await storage.getPrivate({objectKey,maxBytes:1000,allowPublic:false});
  assert.equal(read.bytes.toString(),bytes.toString());
  await assert.rejects(storage.putEncrypted({objectKey,bytes,contentType:'text/html; charset=utf-8',immutable:true,public:false}));
}));
test('tampered ciphertext and wrong encryption key fail authentication', async () => fixture(async ({root,key}) => {
  const storage = createGaizEncryptedFileObjectStore({enabled:true,rootDirectory:root,encryptionKey:key});
  await storage.putEncrypted({objectKey,bytes:Buffer.from('confidential'),contentType:'application/pdf',immutable:true,public:false});
  const other = createGaizEncryptedFileObjectStore({enabled:true,rootDirectory:root,encryptionKey:randomBytes(32)});
  await assert.rejects(other.getPrivate({objectKey,maxBytes:1024,allowPublic:false}));
  const path = join(root,'a'.repeat(64)+'.genc');
  const ciphertext = await readFile(path); ciphertext[ciphertext.length-1] ^= 1;
  await writeFile(path,ciphertext);
  await assert.rejects(storage.getPrivate({objectKey,maxBytes:1024,allowPublic:false}));
}));
test('no path traversal or public read/write, and read byte caps enforced', async () => fixture(async ({root,key}) => {
  const storage = createGaizEncryptedFileObjectStore({enabled:true,rootDirectory:root,encryptionKey:key});
  const bytes = Buffer.from('confidential');
  await assert.rejects(storage.putEncrypted({objectKey:'../stolen',bytes,contentType:'application/pdf',immutable:true,public:false}));
  await assert.rejects(storage.putEncrypted({objectKey,bytes,contentType:'application/pdf',immutable:true,public:true}));
  await storage.putEncrypted({objectKey,bytes,contentType:'application/pdf',immutable:true,public:false});
  await assert.rejects(storage.getPrivate({objectKey,maxBytes:3,allowPublic:false}));
  await assert.rejects(storage.getPrivate({objectKey,maxBytes:1024,allowPublic:true}));
}));
test('cannot read a symlink placed at the encrypted-object path', async () => fixture(async ({root,key}) => {
  const storage = createGaizEncryptedFileObjectStore({enabled:true,rootDirectory:root,encryptionKey:key});
  await symlink('/etc/passwd',join(root,'a'.repeat(64)+'.genc'));
  await assert.rejects(storage.getPrivate({objectKey,maxBytes:1024,allowPublic:false}));
}));


test('ciphertext is bound to its exact private object identity', async () => fixture(async ({root,key}) => {
  const storage = createGaizEncryptedFileObjectStore({enabled:true,rootDirectory:root,encryptionKey:key});
  const otherObjectKey = 'orgaiz/private/staging/' + 'b'.repeat(64);
  await storage.putEncrypted({objectKey,bytes:Buffer.from('sensitive'),
    contentType:'application/pdf',immutable:true,public:false});
  const source = join(root,'a'.repeat(64)+'.genc');
  const target = join(root,'b'.repeat(64)+'.genc');
  await writeFile(target,await readFile(source));
  await assert.rejects(storage.getPrivate({objectKey:otherObjectKey,maxBytes:1024,allowPublic:false}));
}));

test('corrupted encrypted file header is rejected without plaintext fallback', async () => fixture(async ({root,key}) => {
  const storage = createGaizEncryptedFileObjectStore({enabled:true,rootDirectory:root,encryptionKey:key});
  await storage.putEncrypted({objectKey,bytes:Buffer.from('confidential'),
    contentType:'application/pdf',immutable:true,public:false});
  const path = join(root,'a'.repeat(64)+'.genc');
  const blob = await readFile(path);
  blob[0] ^= 1;
  await writeFile(path,blob);
  await assert.rejects(storage.getPrivate({objectKey,maxBytes:1024,allowPublic:false}));
}));

test('unsafe shared directory permissions deny encrypted reads and writes', async () => fixture(async ({root,key}) => {
  const storage = createGaizEncryptedFileObjectStore({enabled:true,rootDirectory:root,encryptionKey:key});
  await chmod(root,0o755);
  await assert.rejects(storage.putEncrypted({objectKey,bytes:Buffer.from('secret'),
    contentType:'application/pdf',immutable:true,public:false}));
  await assert.rejects(storage.getPrivate({objectKey,maxBytes:1024,allowPublic:false}));
}));
