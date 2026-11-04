import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('./paid-deployment.controller.ts', import.meta.url), 'utf8');

test('paid deployment resolves authenticated context inside generic denial boundary', () => {
  const tryAt = controller.indexOf('try {');
  const contextAt = controller.indexOf('currentContext()');
  const catchAt = controller.indexOf('} catch {');
  assert.ok(tryAt >= 0 && contextAt > tryAt && catchAt > contextAt);
  assert.match(controller, /throw new ForbiddenException\\('Access unavailable'\\)/);
  assert.doesNotMatch(controller, /@Req\\(|req\\.headers\\[['\"](?:x-tenant|x-deployment)/i);
});

test('provider selection is checked before runtime deployment or database lookup', () => {
  const guard = controller.indexOf("process.env.BILLING_PROVIDER !== 'stripe'");
  const legacy = controller.indexOf("process.env.STRIPE_ENABLED !== 'true'");
  const paddle = controller.indexOf("process.env.PADDLE_ENABLED === 'true'");
  const runtime = controller.indexOf('parseRuntimeDeployment(process.env)');
  const database = controller.indexOf('withTenant(tenantId');
  assert.ok(guard >= 0 && legacy > guard && paddle > legacy);
  assert.ok(runtime > paddle && database > runtime);
  assert.match(controller, /p\\.provider = 'stripe'/);
  assert.match(controller, /r\\.provider = 'stripe'/);
});

test('paid access cannot be cached and never exposes invoice or subscription identity', () => {
  assert.match(controller, /@Header\\('Cache-Control', 'private, no-store, max-age=0'\\)/);
  assert.match(controller, /@Header\\('Pragma', 'no-cache'\\)/);
  const returned = controller.slice(controller.indexOf('return {'), controller.indexOf('};', controller.indexOf('return {')));
  assert.doesNotMatch(returned, /subscriptionId|invoiceId|paymentIntent|tenantId|userId/);
});
