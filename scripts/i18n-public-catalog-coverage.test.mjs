import test from 'node:test';
import assert from 'node:assert/strict';
import { publicCatalogCoverage } from './i18n-public-catalog-coverage.mjs';
import { buildPublicLocaleCatalog } from './build-public-locale-catalog.mjs';

test('catalog coverage reports every locale and excludes fallback from translated counts', () => {
  const artifact = buildPublicLocaleCatalog();
  const report = publicCatalogCoverage();
  assert.equal(report.productTranslationCertified, false);
  assert.equal(report.reviewedLocales, 0);
  assert.equal(report.records.length, 23);
  assert.equal(report.artifactSha256, artifact.sha256);
  for (const row of report.records) {
    assert.equal(row.totalKeys, Object.keys(artifact.translations).length);
    assert.equal(row.fullyTranslatedProduct, false);
    assert.equal(row.qualityReviewComplete, false);
    const actual = Object.values(artifact.translations)
      .filter(variants => Object.hasOwn(variants, row.locale)).length;
    if (row.sourceLanguage) {
      assert.equal(row.reviewedTranslatedKeys, 0);
      assert.equal(row.englishFallbackKeys, 0);
    } else {
      assert.equal(row.reviewedTranslatedKeys, actual);
      assert.equal(row.englishFallbackKeys + actual, row.totalKeys);
    }
  }
  assert.equal(report.records.find(row => row.locale === 'sw').reviewedTranslatedKeys, 0);
});
