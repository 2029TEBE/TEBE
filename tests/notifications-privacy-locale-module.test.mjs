import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRONTEND_LOCALES } from '../apps/web/src/lib/frontend-locale.mjs';
import { uiLabel, UI_LABELS, catalogLocale } from '../apps/web/src/lib/ui-labels.mjs';
import { formatNumber } from '../apps/web/src/lib/locale-format.mjs';

const page = readFileSync(new URL('../apps/web/src/app/(app)/notifications/page.tsx', import.meta.url), 'utf8');
test('notification page redacts untrusted transport and delivery diagnostics', () => {
  for (const forbidden of ['{d.transport.status}', '{m.error}', '{t(error)}']) {
    assert.ok(!page.includes(forbidden), forbidden + ' must not reach customer UI');
  }
  assert.ok(page.includes("t('Notification action failed.')"));
  assert.ok(page.includes("t('Notification delivery failed.')"));
  assert.ok(page.includes("d.transport.delivers ? t('Mail is being delivered') : t('Nothing is being sent yet')"));
});
test('notifications retain authorized data, manual rule POST, and safe field semantics', () => {
  for (const required of [
    'load={api.notifications}', 'method="post" action="/api/notifications/run"',
    "t('Run the rules now')", 'd.transport.delivers',
    "formatNumber(d.counts[s] ?? 0, locale)", 'term(t, m.status)',
    '<bdi>{m.kind}</bdi>', '<bdi>{m.toEmail}</bdi>', '<bdi>{m.subject}</bdi>',
    '<time dateTime={m.sentAt ?? m.createdAt}>', 'when(m.sentAt, locale)',
    'ago(m.createdAt, locale)', 'tabIndex={0}', 'role="region"',
  ]) assert.ok(page.includes(required), required);
  assert.equal((page.match(/<th scope="col">/g) || []).length, 5);
});
test('generic notification failure notices are translated into every non-English locale', () => {
  assert.equal(FRONTEND_LOCALES.length, 23);
  for (const key of ['Notification action failed.', 'Notification delivery failed.']) {
    for (const locale of FRONTEND_LOCALES) {
      const label = uiLabel(key, locale);
      assert.ok(label.trim(), locale + ': ' + key);
      if (!locale.startsWith('en-')) {
        assert.equal(label, UI_LABELS[key]?.[catalogLocale(locale)]);
        assert.notEqual(label, key, locale);
      }
    }
  }
  for (const locale of FRONTEND_LOCALES) assert.ok(formatNumber(12, locale).trim());
});
