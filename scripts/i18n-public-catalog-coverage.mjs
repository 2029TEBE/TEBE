/**
 * Audited coverage of the narrow, public-safe UI catalog candidate.
 * This is NOT whole-product translation coverage or language approval.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildPublicLocaleCatalog, verifyPublicLocaleCatalog } from './build-public-locale-catalog.mjs';

export function publicCatalogCoverage() {
  const artifact = buildPublicLocaleCatalog();
  if (!verifyPublicLocaleCatalog(artifact)) throw new Error('Invalid public catalog candidate');
  const keys = Object.keys(artifact.translations);
  const records = artifact.locales.map(locale => {
    const translatedKeys = keys.filter(key => Object.hasOwn(artifact.translations[key], locale));
    const isEnglishSource = locale === 'en-US' || locale === 'en-GB';
    return {
      locale,
      scope: 'public-safe-navigation-labels-only',
      totalKeys: keys.length,
      reviewedTranslatedKeys: isEnglishSource ? 0 : translatedKeys.length,
      sourceLanguage: isEnglishSource,
      englishFallbackKeys: isEnglishSource ? 0 : keys.length - translatedKeys.length,
      fullyTranslatedProduct: false,
      qualityReviewComplete: false,
    };
  });
  return {
    reportVersion: 1,
    artifactSha256: artifact.sha256,
    productTranslationCertified: false,
    reviewedLocales: 0,
    records,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.stdout.write(JSON.stringify(publicCatalogCoverage(), null, 2) + '\n');
}
