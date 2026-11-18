// Docker load can retain both content-store blobs and unpacked layers.
// Budget both copies plus a meaningful reserve; never consume rollback space.
import {stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

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
  // Containerd archives can contain gzip-compressed OCI layers inside tar.
  // Count those layers too; outer gzip expansion alone underestimates loading.
  const measured = JSON.parse(execFileSync('python3', [
    fileURLToPath(new URL('./measure-image-archive.py', import.meta.url)), archive,
  ], {encoding: 'utf8', maxBuffer: 16384, timeout: 600000}));
  return {archiveBytes: info.size, ...measured,
    requiredKiB: requiredLoadKiB(measured.effectiveExpandedBytes)};
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
