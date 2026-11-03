import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

const source = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');

test('recurring invoice replay checks current provider Charge reversal before duplicate acknowledgement', () => {
  const start = source.indexOf('if (prior) {', source.indexOf('async settleRecurringInvoice('));
  const end = source.indexOf('if (receipt) throw new ConflictException', start);
  assert.ok(start > 0 && end > start, 'expected recurring replay branch');
  const replay = source.slice(start, end);
  assert.match(replay, /assertRecurringProviderSettlement\(/);
  assert.match(replay, /assertUnreversedRecurringCharge\(intent, charge, replayBinding, replay, false\)/);
  assert.ok(replay.indexOf('assertUnreversedRecurringCharge(') < replay.indexOf('return { received: true, applied: false, duplicate: true'), 'reversal check must precede duplicate acknowledgement');
});

test('new recurring invoice settlement also checks current provider Charge', () => {
  const start = source.indexOf('async settleRecurringInvoice(');
  const end = source.indexOf('\n  async ', start + 6);
  const settlement = source.slice(start, end < 0 ? undefined : end);
  assert.match(settlement, /assertUnreversedRecurringCharge\(intent, charge, binding, verified, false\)/);
});
