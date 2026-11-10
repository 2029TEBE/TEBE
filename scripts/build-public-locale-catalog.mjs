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

// Only explicitly reviewed, non-sensitive navigation copy is exportable.
// Any expansion requires an intentional allowlist edit and CI review.
export const PUBLIC_CATALOG_KEYS = Object.freeze([
  'Home', 'Projects', 'Portfolios', 'Reports', 'Settings', 'Analytics',
  'Benefits', 'Documents', 'Financials', 'Notifications',
  'Integrations', 'Resources', 'Stakeholders', 'Subscriptions',
  'The EPMO', 'Modules', 'Skip to content',
]);

export function buildPublicLocaleCatalog() {
  const locales = [...FRONTEND_LOCALES];
  const keys = [...PUBLIC_CATALOG_KEYS].sort();
  for (const key of keys) {
    if (!Object.hasOwn(UI_LABELS, key)) throw new Error('Public catalog allowlist refers to an absent source key');
  }
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

// Validate a generated artifact before CI passes it to another repository.
// Integrity is not authentication: CI must separately pin the trusted source.
export function verifyPublicLocaleCatalog(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return false;
  const { sha256, ...payload } = document;
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) return false;
  if (payload.schemaVersion !== 1 ||
      payload.scope !== 'public-safe-shared-ui-labels-only' ||
      payload.releaseApproved !== false || payload.coverage !== 'partial' ||
      payload.defaultLocale !== 'en-US') return false;
  if (!Array.isArray(payload.locales) ||
      JSON.stringify(payload.locales) !== JSON.stringify(FRONTEND_LOCALES)) return false;
  if (payload.source !== 'THE EPMO SaaS UI catalog') return false;
  if (Object.keys(payload).sort().join(',') !==
      'coverage,defaultLocale,locales,releaseApproved,schemaVersion,scope,source,translations') return false;
  if (!payload.translations || typeof payload.translations !== 'object' ||
      Array.isArray(payload.translations)) return false;
  const publicKeys = [...PUBLIC_CATALOG_KEYS].sort();
  const actualKeys = Object.keys(payload.translations).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(publicKeys)) return false;
  for (const [source, variants] of Object.entries(payload.translations)) {
    if (!Object.hasOwn(UI_LABELS, source)) return false;
    if (!source.trim() || ['__proto__', 'prototype', 'constructor'].includes(source)) return false;
    if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return false;
    for (const [locale, translated] of Object.entries(variants)) {
      if (!FRONTEND_LOCALES.includes(locale) ||
          typeof translated !== 'string' || !translated.trim() ||
          !translationHasMatchingPlaceholders(source, translated)) return false;
    }
  }
  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex') === sha256;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.stdout.write(JSON.stringify(buildPublicLocaleCatalog(), null, 2) + '\n');
}
