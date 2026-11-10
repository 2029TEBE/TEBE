import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildPublicLocaleCatalog, verifyPublicLocaleCatalog, PUBLIC_CATALOG_KEYS } from './build-public-locale-catalog.mjs';

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

test('public catalog validator rejects tampering, unregistered variants and false approval', () => {
  const original = buildPublicLocaleCatalog();
  assert.equal(verifyPublicLocaleCatalog(original), true);
  const tampered = structuredClone(original);
  tampered.translations.Projects.de = 'Tampered';
  assert.equal(verifyPublicLocaleCatalog(tampered), false);
  const unregistered = structuredClone(original);
  unregistered.locales.push('xx');
  assert.equal(verifyPublicLocaleCatalog(unregistered), false);
  const fakeRelease = structuredClone(original);
  fakeRelease.releaseApproved = true;
  assert.equal(verifyPublicLocaleCatalog(fakeRelease), false);
  const invalid = structuredClone(original);
  invalid.translations.Projects.xx = 'Translation';
  assert.equal(verifyPublicLocaleCatalog(invalid), false);
  assert.equal(verifyPublicLocaleCatalog(null), false);
});

test('public artifact exports explicitly allowlisted navigation copy only', () => {
  const catalog = buildPublicLocaleCatalog();
  assert.deepEqual(Object.keys(catalog.translations).sort(), [...PUBLIC_CATALOG_KEYS].sort());
  assert.ok(!Object.hasOwn(catalog.translations, 'These are the current workspace API signals, not automated decisions or approvals.'));
  assert.ok(!Object.hasOwn(catalog.translations, 'Projects returned in the attention queue'));
  assert.equal(new Set(PUBLIC_CATALOG_KEYS).size, PUBLIC_CATALOG_KEYS.length);
});
