import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudflareTransport, pilotRecipients } from './cloudflare-transport.ts';

const config = { accountId: 'a'.repeat(32), token: 'test-only-token', from: 'security@theepmo.com' };
const message = { to: 'owner@example.com', subject: 'Reset your password', body: 'Use this link:\nhttps://app.theepmo.com/reset-password?token=TEST&next=<unsafe>', lang: 'en' };
const response = result => new Response(JSON.stringify({ success: true, result }), { status: 200 });

test('only accepts complete account, token and mailbox configuration', () => {
  for (const invalid of [{ accountId: '../other' }, { token: '' }, { token: 'x\r\nheader: bad' }, { from: 'Sender <security@theepmo.com>' }]) {
    assert.equal(createCloudflareTransport({ ...config, ...invalid }), null);
  }
});
test('sends only to fixed HTTPS endpoint, with bounded timeout, no redirects and safe HTML', async () => {
  const transport = createCloudflareTransport(config, async (url, options) => {
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`);
    assert.equal(options.redirect, 'error');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.authorization, 'Bearer test-only-token');
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.from, { address: config.from, name: 'The EPMO' });
    assert.equal(body.text, message.body);
    assert.match(body.html, /&amp;next=&lt;unsafe&gt;/);
    assert.match(body.html, /dir="ltr"/);
    return response({ delivered: [message.to], queued: [], permanent_bounces: [] });
  });
  assert.deepEqual(await transport.send(message), { ok: true });
});
test('Arabic messages use RTL and queued acceptance is recognized', async () => {
  const transport = createCloudflareTransport(config, async (_, options) => {
    assert.match(JSON.parse(options.body).html, /lang="ar" dir="rtl"/);
    return response({ queued: [message.to] });
  });
  assert.deepEqual(await transport.send({ ...message, lang: 'ar' }), { ok: true });
});
test('rejects bounced, missing, unrelated or malformed success acknowledgements', async () => {
  for (const result of [null, {}, { delivered: ['someone@example.com'] },
    { delivered: [message.to], permanent_bounces: [message.to] }]) {
    const transport = createCloudflareTransport(config, async () => response(result));
    assert.equal((await transport.send(message)).ok, false);
  }
});
test('provider failures, bad JSON and network errors fail closed without leaking details or retrying', async () => {
  const secret = 'secret-token-and-reset-url';
  for (const failure of [() => new Response(secret, { status: 429 }),
    () => new Response(secret, { status: 401 }),
    () => new Response(secret, { status: 200 }),
    () => new Response(JSON.stringify({ success: false, errors: [secret] })),
    () => { throw new Error(secret); }]) {
    let calls = 0;
    const transport = createCloudflareTransport(config, async () => { calls++; return failure(); });
    const result = await transport.send(message);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(calls, 1);
  }
});
test('malformed recipient and subject never reach the provider', async () => {
  const transport = createCloudflareTransport(config, async () => { throw new Error('must not call'); });
  for (const invalid of [{ to: 'a@example.com\r\nbcc: b@example.com' }, { subject: 'bad\r\nheader' }, { subject: '' }]) {
    assert.equal((await transport.send({ ...message, ...invalid })).error, 'Invalid transactional email.');
  }
});

test('pilot caps unique mailboxes at 200 and normalizes case without allocating action quotas', () => {
  const addresses = Array.from({length: 200}, (_, n) => `person${n}@example.com`);
  assert.equal(pilotRecipients(addresses.join(',')).size, 200);
  assert.equal(pilotRecipients([...addresses, 'PERSON0@EXAMPLE.COM'].join(',')).size, 200);
  assert.equal(pilotRecipients([...addresses, 'overflow@example.com'].join(',')), null);
  for (const invalid of ['', '*@example.com', 'user@example.com\r\nbcc:other@example.com']) {
    assert.equal(pilotRecipients(invalid), null);
  }
});
test('unapproved recipients are blocked before any provider request; approved recipients can get repeated transactional messages', async () => {
  let calls = 0;
  const transport = createCloudflareTransport({...config, pilotAllowlist: message.to}, async () => {
    calls++; return response({queued: [message.to]});
  });
  assert.equal(transport.pilot.mode, 'verified-only');
  assert.equal(transport.canSendTo(message.to.toUpperCase()), true);
  assert.equal((await transport.send({...message, to: 'other@example.com'})).ok, false);
  assert.equal(calls, 0);
  assert.equal((await transport.send(message)).ok, true);
  assert.equal((await transport.send({...message, subject: 'Workspace invitation'})).ok, true);
  assert.equal(calls, 2);
  assert.equal(transport.pilot.approvedRecipients, 1);
  assert.equal(createCloudflareTransport({...config, pilotAllowlist: ''}), null);
});
