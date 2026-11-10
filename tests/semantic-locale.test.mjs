import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { navigationArabic } from '../packages/contracts/src/nav-locale.ts';

const source = readFileSync(new URL('../packages/contracts/src/semantic-locale.ts', import.meta.url), 'utf8');
const entries = [...source.matchAll(/^  '([^']+)': '([^']+)',?$/gm)].map(([, key, value]) => [key, value]);

test('semantic vocabulary is typed and backed by the existing reviewed Arabic source', () => {
  assert.ok(entries.length >= 15);
  assert.match(source, /navigationArabic\(english\)/);
  assert.match(source, /resolveLocale\(requestedLocale\) === 'ar'/);
  assert.match(source, /return .*\? navigationArabic\(english\) : english/);
  for (const [key, english] of entries) {
    assert.ok(/^[a-z][a-zA-Z]*\.[a-zA-Z]+$/.test(key), key);
    assert.ok(english.trim());
    assert.notEqual(navigationArabic(english), english, 'missing reviewed Arabic: ' + key);
  }
});

test('semantic keys are unique and preserve existing navigation vocabulary', () => {
  assert.equal(new Set(entries.map(([key]) => key)).size, entries.length);
  assert.ok(entries.some(([key, value]) => key === 'navigation.projects' && value === 'Projects'));
  assert.equal(navigationArabic('Projects'), 'المشاريع');
});
