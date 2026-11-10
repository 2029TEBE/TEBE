import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildPublicLocaleCatalog } from './build-public-locale-catalog.mjs';

test('public locale build is deterministic and explicitly not a complete translation release', () => {
  const a = buildPublicLocaleCatalog();
  const b = buildPublicLocaleCatalog();
  assert.deepEqual(a, b);
  assert.equal(a.schemaVersion, 1);
  assert.equal(a.releaseApproved, false);
  assert.equal(a.coverage, 'partial');
  assert.equal(a.locales.length, 23);
  assert.equal(new Set(a.locales.map(locale => locale.split('-')[0])).size, 19);
  assert.ok(Object.keys(a.translations).length > 0);
  const { sha256, ...payload } = a;
  assert.equal(createHash('sha256').update(JSON.stringify(payload)).digest('hex'), sha256);
});

test('public catalog contains no backend sources and does not invent absent translations', () => {
  const catalog = buildPublicLocaleCatalog();
  assert.ok(!JSON.stringify(catalog).includes('DATABASE_URL'));
  assert.ok(!JSON.stringify(catalog).includes('MS_CLIENT_SECRET'));
  assert.deepEqual(catalog.translations.Projects.de, 'Projekte');
  assert.equal(Object.hasOwn(catalog.translations.Projects, 'sw'), false);
  for (const [key, translations] of Object.entries(catalog.translations)) {
    assert.ok(key.trim());
    for (const locale of Object.keys(translations)) assert.ok(catalog.locales.includes(locale), locale);
  }
});
