import test from 'node:test';
import assert from 'node:assert/strict';
import { SEMANTIC_LABELS, semanticEnglish, semanticLabel } from '../packages/contracts/src/semantic-locale.ts';
import { navigationArabic } from '../packages/contracts/src/nav-locale.ts';

test('semantic keys are stable and preserve existing reviewed Arabic terminology', () => {
  assert.ok(Object.keys(SEMANTIC_LABELS).length >= 15);
  for (const key of Object.keys(SEMANTIC_LABELS)) {
    const english = semanticEnglish(key);
    assert.ok(english.trim(), key);
    assert.equal(semanticLabel(key, 'en-GB'), english);
    assert.equal(semanticLabel(key, 'ar-SA'), navigationArabic(english));
  }
  assert.equal(semanticLabel('navigation.projects', 'ar'), 'المشاريع');
  assert.equal(semanticLabel('navigation.projects', 'sw'), 'Projects');
});

test('semantic keys are unique and do not encode the display copy as identifiers', () => {
  const keys = Object.keys(SEMANTIC_LABELS);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every(key => /^[a-z][a-zA-Z]*\.[a-zA-Z]+$/.test(key)));
});
