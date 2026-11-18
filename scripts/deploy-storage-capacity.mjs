// Docker load can retain both content-store blobs and unpacked layers.
// Budget both copies plus a meaningful reserve; never consume rollback space.
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createGunzip} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const GiB = 1024 ** 3;
export function requiredLoadKiB(expandedBytes) {
  if (!Number.isSafeInteger(expandedBytes) || expandedBytes <= 0 || expandedBytes > 32 * GiB)
    throw Error('Invalid or excessive expanded image archive size');
  return Math.ceil((2 * expandedBytes + 2 * GiB) / 1024);
}
export async function measureLoadCapacity(archive) {
  const info = await stat(archive);
  if (!info.isFile() || info.size <= 0 || info.size > 8 * GiB)
    throw Error('Invalid image archive');
  let expandedBytes = 0;
  const input = createReadStream(archive);
  const output = createGunzip();
  input.on('error', error => output.destroy(error));
  input.pipe(output);
  try {
    for await (const chunk of output) {
      expandedBytes += chunk.length;
      if (expandedBytes > 32 * GiB) throw Error('Expanded image archive exceeds 32 GiB');
    }
  } finally {
    input.destroy();
    output.destroy();
  }
  return {archiveBytes: info.size, expandedBytes, requiredKiB: requiredLoadKiB(expandedBytes)};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await measureLoadCapacity(process.argv[2]);
    console.error('Docker load capacity: ' + JSON.stringify(result));
    console.log(result.requiredKiB);
  } catch (error) {
    console.error('BLOCKED: cannot establish Docker load capacity: ' + error.message);
    process.exitCode = 1;
  }
}
