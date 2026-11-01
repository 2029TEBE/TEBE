import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Exercise the production upload-session method with deterministic Graph and
// preauthenticated upload transports. No Entra consent, secrets or network.
const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const start = source.indexOf('  private async uploadLarge(');
const end = source.indexOf('  /**\n   * A short-lived link', start);
assert.ok(start >= 0 && end > start, 'Graph upload session method must exist');
const method = source.slice(start, end)
  .replace(/private async uploadLarge\(token: string, driveId: string, parentId: string,\s*filename: string, buf: Buffer\)/,
    'async function uploadLarge(token, driveId, parentId, filename, buf)')
  .replaceAll('call<any>', 'call')
  .replace('let item: unknown;', 'let item;')
  .replace('return item as GraphUploadedFile;', 'return item;');

class MsApiError extends Error {
  constructor(status, code, message) { super(message ?? 'Graph rejected upload'); this.status = status; this.code = code; }
}
class BadRequestException extends Error {}

function makeUpload(graph, transport) {
  return new Function('call', 'GRAPH', 'microsoftUploadUrl', 'fetch', 'AbortSignal',
    'MsApiError', 'BadRequestException', 'readBoundedMicrosoftJson',
    'MAX_MICROSOFT_API_RESPONSE_BYTES',
    method + '\nreturn uploadLarge;')(
      graph, 'https://graph.microsoft.com/v1.0',
      (url) => {
        assert.equal(url, 'https://upload.example.test/session');
        return url;
      }, transport, AbortSignal, MsApiError, BadRequestException,
      async (res) => res.json(), 1024 * 1024);
}

const session = { uploadUrl: 'https://upload.example.test/session' };
const completed = { id: 'new-item', webUrl: 'https://example.test/new-item', file: {}, size: 5 };

test('E53: document upload always uses create-only session, never direct overwrite PUT', () => {
  const upload = source.slice(source.indexOf('  async upload(b:'), start);
  assert.match(upload, /const item = await this\.uploadLarge\(token, c\.drive_id, parentId, filename, file\.buffer\)/);
  assert.doesNotMatch(upload, /conflictBehavior=replace|:\/content/);
  assert.match(method, /'@microsoft\.graph\.conflictBehavior': 'fail'/);
  assert.doesNotMatch(method, /'@microsoft\.graph\.conflictBehavior': 'replace'/);
});

test('E53: a small file uses an authenticated create-only session and a preauthenticated chunk', async () => {
  let graphCalls = 0, chunkCalls = 0;
  const upload = makeUpload(async (_base, token, path, init) => {
    graphCalls++;
    assert.equal(token, 'delegated-token');
    assert.match(path, /\/items\/root:\/report\.txt:\/createUploadSession$/);
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(init.body).item, {
      '@microsoft.graph.conflictBehavior': 'fail', name: 'report.txt',
    });
    return session;
  }, async (url, init) => {
    chunkCalls++;
    assert.equal(url, session.uploadUrl);
    assert.equal(init.method, 'PUT');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers['content-range'], 'bytes 0-4/5');
    assert.equal(init.headers['content-length'], '5');
    assert.equal(init.headers.authorization, undefined);
    assert.equal(Buffer.from(init.body).toString(), 'hello');
    return new Response(JSON.stringify(completed), { status: 201 });
  });
  assert.deepEqual(await upload('delegated-token', 'drive', 'root', 'report.txt', Buffer.from('hello')), completed);
  assert.equal(graphCalls, 1);
  assert.equal(chunkCalls, 1);
});

test('E53: Graph 409 name collision is rejected before any customer bytes are uploaded', async () => {
  let chunks = 0;
  const upload = makeUpload(async () => { throw new MsApiError(409, 'nameAlreadyExists'); },
    async () => { chunks++; throw Error('must not send bytes'); });
  await assert.rejects(upload('token', 'drive', 'root', 'report.txt', Buffer.from('hello')),
    (e) => e instanceof MsApiError && e.status === 409);
  assert.equal(chunks, 0);
});

test('E53: late 409 at final chunk cannot be reported as a completed document', async () => {
  const upload = makeUpload(async () => session,
    async () => new Response(JSON.stringify({ error: { code: 'nameAlreadyExists' } }), { status: 409 }));
  await assert.rejects(upload('token', 'drive', 'root', 'report.txt', Buffer.from('hello')),
    (e) => e instanceof MsApiError && e.status === 409);
});

test('E53: invalid completed Graph metadata cannot become a document', async () => {
  const upload = makeUpload(async () => session,
    async () => new Response(JSON.stringify({ id: 'file-without-url' }), { status: 201 }));
  await assert.rejects(upload('token', 'drive', 'root', 'report.txt', Buffer.from('hello')),
    (e) => e instanceof MsApiError && e.code === 'uploadInvalid');
});

test('E53: empty files fail before a session or preauthenticated URL is created', async () => {
  let calls = 0;
  const upload = makeUpload(async () => { calls++; return session; },
    async () => { calls++; throw Error('must not upload'); });
  await assert.rejects(upload('token', 'drive', 'root', 'empty.txt', Buffer.alloc(0)), BadRequestException);
  assert.equal(calls, 0);
});
