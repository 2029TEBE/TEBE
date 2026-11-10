import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudflareMailTransport, cloudflareMailConfig } from './cloudflare-mail.ts';

const config = { accountId: 'a'.repeat(32), token: 'test-only-sending-token-123456', from: 'accounts@example.com' };
const message = { to: 'customer@example.com', subject: 'استعادة الحساب', body: 'رابط آمن\nhttps://example.com/reset?token=test-only', lang: 'ar' };
const result = extra => ({ success: true, errors: [], result: {
  delivered: [], queued: [], permanent_bounces: [], suppressed_recipients: [], ...extra } });
const transport = payload => new CloudflareMailTransport(config, async () => Response.json(payload));

test('configuration rejects missing credentials, injected account paths and sender headers', () => {
  assert.equal(cloudflareMailConfig({}), null);
  for (const extra of [{ MAIL_CF_ACCOUNT_ID: '../other' }, { MAIL_CF_API_TOKEN: 'secret\r\nheader' },
    { MAIL_FROM: 'accounts@example.com\r\nBcc: other@example.com' }]) {
    assert.equal(cloudflareMailConfig({ MAIL_CF_ACCOUNT_ID: config.accountId,
      MAIL_CF_API_TOKEN: config.token, MAIL_FROM: config.from, ...extra }), null);
  }
});

test('sends one bounded UTF-8 text message to the fixed API without following redirects', async () => {
  let called = 0;
  const mail = new CloudflareMailTransport(config, async (url, options) => {
    called++;
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, `Bearer ${config.token}`);
    assert.deepEqual(JSON.parse(options.body), { from: config.from, to: message.to,
      subject: message.subject, text: message.body });
    return Response.json(result({ delivered: [message.to] }));
  });
  assert.deepEqual(await mail.send(message), { ok: true });
  assert.equal(called, 1);
});

test('provider acceptance may be immediate or queued for the exact recipient', async () => {
  for (const state of ['delivered', 'queued'])
    assert.deepEqual(await transport(result({ [state]: [message.to] })).send(message), { ok: true });
});

test('bounces, suppressions and unmatched recipient results never count as acceptance', async () => {
  for (const extra of [{ permanent_bounces: [message.to] }, { suppressed_recipients: [message.to] },
    { queued: ['somebody-else@example.com'] }, {},
    { delivered: [message.to], permanent_bounces: [message.to] }]) {
    assert.equal((await transport(result(extra)).send(message)).ok, false);
  }
});

test('malformed or unsuccessful provider envelopes fail closed', async () => {
  for (const payload of [null, {}, { success: false }, result({ queued: 'invalid' }),
    { ...result({ queued: [message.to] }), errors: [{ code: 10001 }] }])
    assert.equal((await transport(payload).send(message)).ok, false);
});

test('invalid addresses, header injection and oversized messages never contact the provider', async () => {
  const mail = new CloudflareMailTransport(config, async () => { throw new Error('NETWORK MUST NOT RUN'); });
  for (const extra of [{ to: 'one@example.com,two@example.com' }, { subject: 'hello\r\nBcc: x' },
    { body: '' }, { body: 'ع'.repeat(262144) }]) {
    const response = await mail.send({ ...message, ...extra });
    assert.equal(response.error, 'Invalid transactional email content.');
  }
});

test('HTTP failures do not expose response bodies and ambiguous failures are not retried', async () => {
  const failure = new CloudflareMailTransport(config, async () =>
    new Response(message.body + config.token, { status: 403 }));
  const denied = await failure.send(message);
  assert.equal(denied.ok, false);
  assert.ok(!denied.error.includes(config.token) && !denied.error.includes('token=test-only'));
  let calls = 0;
  const timeout = new CloudflareMailTransport(config, async () => { calls++; throw new Error(config.token); });
  const uncertain = await timeout.send(message);
  assert.equal(uncertain.ok, false);
  assert.equal(calls, 1);
  assert.ok(!uncertain.error.includes(config.token));
});
