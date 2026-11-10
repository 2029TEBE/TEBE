/**
 * Public-only, deterministic localization artifact candidate for TEFE.
 * Intentionally excludes contracts, backend, user data and credentials.
 * This is NOT a full 19-language translation release.
 */
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { FRONTEND_LOCALES } from '../apps/web/src/lib/frontend-locale.mjs';
import { UI_LABELS, catalogLocale, translationHasMatchingPlaceholders } from '../apps/web/src/lib/ui-labels.mjs';

export function buildPublicLocaleCatalog() {
  const locales = [...FRONTEND_LOCALES];
  const keys = Object.keys(UI_LABELS).sort();
  const translations = {};
  for (const english of keys) {
    const row = UI_LABELS[english];
    const approved = {};
    for (const locale of locales) {
      const candidate = row[catalogLocale(locale)];
      if (typeof candidate !== 'string' || !candidate.trim()) continue;
      if (!translationHasMatchingPlaceholders(english, candidate)) {
        throw new Error('Invalid translated placeholders in catalog entry');
      }
      approved[locale] = candidate;
    }
    if (Object.keys(approved).length) translations[english] = approved;
  }
  const payload = {
    schemaVersion: 1,
    source: 'THE EPMO SaaS UI catalog',
    scope: 'public-safe-shared-ui-labels-only',
    releaseApproved: false,
    coverage: 'partial',
    defaultLocale: 'en-US',
    locales,
    translations,
  };
  const json = JSON.stringify(payload);
  return {
    ...payload,
    sha256: createHash('sha256').update(json, 'utf8').digest('hex'),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.stdout.write(JSON.stringify(buildPublicLocaleCatalog(), null, 2) + '\n');
}
