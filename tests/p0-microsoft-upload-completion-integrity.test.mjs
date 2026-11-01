import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Exercise the actual uploadLarge implementation with deterministic transports.
// No external Microsoft tenant, tokens, upload URL or customer data are used.
const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const start = source.indexOf('  private async uploadLarge(');
const end = source.indexOf('  /**\n   * A short-lived link', start);
assert.ok(start >= 0 && end > start, 'uploadLarge source boundary must exist');
const method = source.slice(start, end)
  .replace(/private async uploadLarge\(token: string, driveId: string, parentId: string,\s*filename: string, buf: Buffer\)/,
    'async function uploadLarge(token, driveId, parentId, filename, buf)')
  .replaceAll('call<any>', 'call')
  .replace('let item: unknown;', 'let item;')
  .replace('return item as GraphUploadedFile;', 'return item;');

class MsApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
class BadRequestException extends Error {}

function uploadFor(item) {
  return new Function('call', 'GRAPH', 'microsoftUploadUrl', 'fetch', 'AbortSignal',
    'MsApiError', 'BadRequestException', 'readBoundedMicrosoftJson',
    'MAX_MICROSOFT_API_RESPONSE_BYTES',
    method + '\nreturn uploadLarge;')(
      async () => ({ uploadUrl: 'https://upload.example.test/session' }),
      'https://graph.microsoft.com/v1.0',
      (url) => url,
      async (_url, init) => {
        assert.equal(init.method, 'PUT');
        assert.equal(init.redirect, 'error');
        return new Response(JSON.stringify(item), { status: 201 });
      },
      AbortSignal, MsApiError, BadRequestException,
      async (res) => res.json(), 1024 * 1024);
}
const file = Buffer.from('hello');
const valid = {
  id: 'new-file', webUrl: 'https://tenant.sharepoint.com/new-file',
  name: 'report.txt', size: 5, file: {},
  parentReference: { driveId: 'drive', id: 'root' },
};
const run = (item) => uploadFor(item)('delegated-token', 'drive', 'root', 'report.txt', file);
const rejected = (item) => assert.rejects(run(item),
  (error) => error instanceof MsApiError && error.status === 502 && error.code === 'uploadInvalid');

test('E54: correctly identified completed file remains accepted', async () => {
  assert.deepEqual(await run(valid), valid);
});
test('E54: reject a completed upload with another filename', async () => {
  await rejected({ ...valid, name: 'other-user-file.txt' });
});
test('E54: reject a partial or inflated completed upload byte count', async () => {
  await rejected({ ...valid, size: 4 });
  await rejected({ ...valid, size: 999 });
  await rejected({ ...valid, size: '5' });
});
test('E54: reject a folder masquerading as the completed upload', async () => {
  await rejected({ ...valid, folder: {} });
});
test('E54: reject a completed item from another drive or parent', async () => {
  await rejected({ ...valid, parentReference: { driveId: 'another-drive', id: 'root' } });
  await rejected({ ...valid, parentReference: { driveId: 'drive', id: 'another-parent' } });
});
test('E54: reject empty item identity and malformed parent metadata', async () => {
  await rejected({ ...valid, id: ' ' });
  await rejected({ ...valid, parentReference: 'unexpected' });
});
