import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {tarArchive} from './image-archive-fixture.mjs';
import {requiredLoadKiB, measureLoadCapacity} from './deploy-storage-capacity.mjs';

test('load budget includes two expanded copies and a 2 GiB reserve', () => {
  assert.equal(requiredLoadKiB(1024 ** 3), 4 * 1024 ** 2);
  assert.equal(requiredLoadKiB(1), 2 * 1024 ** 2 + 1);
  for (const value of [0, -1, NaN, Infinity, 1.5, 33 * 1024 ** 3])
    assert.throws(() => requiredLoadKiB(value));
});
test('measure actual decompressed bytes and reject corrupt gzip', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'epmo-capacity-test-'));
  try {
    const file = join(dir, 'images.tar.gz');
    const bytes = tarArchive('layer.tar', Buffer.alloc(131071, 42));
    await writeFile(file, gzipSync(bytes));
    const result = await measureLoadCapacity(file);
    assert.equal(result.expandedBytes, bytes.length);
    assert.equal(result.requiredKiB, requiredLoadKiB(bytes.length));
    await writeFile(file, 'invalid gzip');
    await assert.rejects(measureLoadCapacity(file));
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('nested OCI gzip layers increase the reserve budget without extraction', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'epmo-oci-capacity-test-'));
  try {
    const file = join(dir, 'images.tar.gz');
    const layer = Buffer.alloc(262144, 42);
    const compressed = gzipSync(layer);
    const tar = tarArchive('blobs/sha256/layer', compressed);
    await writeFile(file, gzipSync(tar));
    const result = await measureLoadCapacity(file);
    assert.equal(result.expandedBytes, tar.length);
    assert.equal(result.nestedInflationBytes, layer.length - compressed.length);
    assert.equal(result.effectiveExpandedBytes, tar.length + layer.length - compressed.length);
    assert.equal(result.requiredKiB, requiredLoadKiB(result.effectiveExpandedBytes));
    assert.ok(result.requiredKiB > requiredLoadKiB(tar.length));
    await writeFile(file, gzipSync(tarArchive('blobs/sha256/layer', Buffer.from([0x28, 0xb5, 0x2f, 0xfd]))));
    await assert.rejects(measureLoadCapacity(file));
  } finally { await rm(dir, {recursive: true, force: true}); }
});
