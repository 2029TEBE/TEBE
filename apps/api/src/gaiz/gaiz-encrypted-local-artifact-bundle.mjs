// Assembly seam for the existing private GAIZ artifact service from PR #527.
// This is NOT an app module and must never be mounted automatically.
import { createGaizEncryptedFileObjectStore }
 from './gaiz-encrypted-file-object-store.mjs';
import { createGaizPrivateArtifactStore }
 from './gaiz-private-artifact-store.mjs';

export function createGaizEncryptedLocalArtifactBundle({
 enabled = false, rootDirectory, encryptionKey, pool,
 maxBytes = 10_000_000
} = {}) {
 if (enabled !== true || !pool) {
  throw Error('GAIZ encrypted artifact bundle unavailable');
 }
 const objectStore = createGaizEncryptedFileObjectStore({
  enabled: true, rootDirectory, encryptionKey, maxBytes
 });
 const artifacts = createGaizPrivateArtifactStore({
  enabled: true, pool, objectStore, maxBytes
 });
 // This adapter is passed server-side to the report worker and
 // customer report service; it is not a public object-storage URL.
 return Object.freeze({ artifacts });
}
