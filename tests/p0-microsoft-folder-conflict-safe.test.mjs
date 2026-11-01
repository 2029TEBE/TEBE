import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Execute the actual folder method with a deterministic Graph transport stub.
// No credentials, network requests, database, or customer files are involved.
const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const start = source.indexOf('  private async folder(');
const end = source.indexOf('  private async connection(', start);
assert.ok(start >= 0 && end > start, 'Graph folder implementation must be present');
const method = source.slice(start, end)
  .replace('private async folder(token: string, driveId: string, parentId: string, name: string)',
    'async function folder(token, driveId, parentId, name)')
  .replace('(item: any)', '(item)')
  .replaceAll('call<any>', 'call');

class MsApiError extends Error {
  constructor(status) { super('Microsoft request failed'); this.status = status; }
}
class ConflictException extends Error {}
const folderFor = (transport) =>
  new Function('call', 'GRAPH', 'MsApiError', 'ConflictException',
    `${method}\nreturn folder;`)(
      transport, 'https://graph.microsoft.com/v1.0', MsApiError, ConflictException);

const folder = { id: 'folder-123', folder: { childCount: 0 }, webUrl: 'https://example.test/folder' };
const file = { id: 'file-123', file: { mimeType: 'text/plain' } };
const notFound = () => { throw new MsApiError(404); };

test('E52: existing folder is reused without creating or overwriting an item', async () => {
  let calls = 0;
  const result = await folderFor(async () => { calls++; return folder; })('token', 'drive', 'root', 'EPMO');
  assert.equal(result.id, folder.id);
  assert.equal(calls, 1);
});

test('E52: missing folder is created with Graph conflictBehavior fail', async () => {
  const calls = [];
  const result = await folderFor(async (_base, _token, path, init) => {
    calls.push({ path, init });
    if (!init) return notFound();
    return folder;
  })('token', 'drive', 'root', 'EPMO');
  assert.equal(result.id, folder.id);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.method, 'POST');
  assert.equal(JSON.parse(calls[1].init.body)['@microsoft.graph.conflictBehavior'], 'fail');
});

test('E52: concurrent Graph 409 is resolved by one bounded verified reread', async () => {
  let calls = 0;
  const result = await folderFor(async () => {
    calls++;
    if (calls === 1) return notFound();
    if (calls === 2) throw new MsApiError(409);
    return folder;
  })('token', 'drive', 'root', 'EPMO');
  assert.equal(result.id, folder.id);
  assert.equal(calls, 3);
});

test('E52: an existing same-name file is rejected before any POST', async () => {
  let calls = 0;
  await assert.rejects(
    folderFor(async () => { calls++; return file; })('token', 'drive', 'root', 'EPMO'),
    ConflictException);
  assert.equal(calls, 1);
});

test('E52: a conflicting file created during a race is rejected', async () => {
  let calls = 0;
  await assert.rejects(folderFor(async () => {
    calls++;
    if (calls === 1) return notFound();
    if (calls === 2) throw new MsApiError(409);
    return file;
  })('token', 'drive', 'root', 'EPMO'), ConflictException);
  assert.equal(calls, 3);
});

test('E52: unresolved conflict is not reported as successful folder creation', async () => {
  let calls = 0;
  await assert.rejects(folderFor(async () => {
    calls++;
    if (calls === 2) throw new MsApiError(412);
    return notFound();
  })('token', 'drive', 'root', 'EPMO'), (error) => error instanceof MsApiError && error.status === 412);
  assert.equal(calls, 3);
});

test('E52: malformed Graph POST result cannot be used as a destination', async () => {
  await assert.rejects(folderFor(async (_base, _token, _path, init) => {
    if (!init) return notFound();
    return { id: 'item', folder: null };
  })('token', 'drive', 'root', 'EPMO'), ConflictException);
});
