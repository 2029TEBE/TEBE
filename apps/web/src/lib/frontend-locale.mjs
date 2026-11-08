/**
 * Frontend-only locale selection foundation for a future six-language UI.
 *
 * This module is NOT wired to the existing `pmo_lang` cookie or API. Until
 * complete translation packs exist, the current English/Arabic UI continues
 * using the original i18n.ts behavior unchanged.
 *
 * Priority: explicit choice > saved choice > browser preference > country hint
 * > English. Country is a weak hint, never proof of language or data residency.
 */
export const FRONTEND_LOCALES = Object.freeze([
  'en', 'ar-SA', 'de-DE', 'zh-CN', 'fr-FR', 'ja-JP',
]);

const COUNTRY_HINTS = Object.freeze({
  SA: 'ar-SA', AE: 'ar-SA', QA: 'ar-SA', BH: 'ar-SA',
  KW: 'ar-SA', OM: 'ar-SA',
  DE: 'de-DE', AT: 'de-DE', CH: 'de-DE',
  CN: 'zh-CN',
  FR: 'fr-FR',
  JP: 'ja-JP',
});

/**
 * Map a requested tag to a supported frontend locale, or null.
 * zh-HK / zh-TW stay unsupported; they must never silently be relabeled as
 * Simplified Chinese just because the base language matches.
 */
export function normalizeFrontendLocale(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const tag = input.trim().replaceAll('_', '-').toLowerCase();
  if (tag === 'zh' || tag === 'zh-cn' || tag === 'zh-sg' || tag === 'zh-hans' || tag.startsWith('zh-hans-')) return 'zh-CN';
  if (tag === 'zh-tw' || tag === 'zh-hk' || tag === 'zh-mo' || tag.startsWith('zh-hant')) return null;
  const base = tag.split('-')[0];
  const aliases = { en: 'en', ar: 'ar-SA', de: 'de-DE', fr: 'fr-FR', ja: 'ja-JP' };
  return Object.hasOwn(aliases, base) ? aliases[base] : null;
}

/** Accepts e.g. ['de-CH','en-US']; caller must not pass arbitrary network headers. */
export function chooseFrontendLocale({
  selected = null,
  saved = null,
  browserLanguages = [],
  country = null,
} = {}) {
  for (const preferred of [selected, saved]) {
    const normalized = normalizeFrontendLocale(preferred);
    if (normalized) return normalized;
  }
  if (Array.isArray(browserLanguages)) {
    for (const language of browserLanguages) {
      const normalized = normalizeFrontendLocale(language);
      if (normalized) return normalized;
    }
  }
  if (typeof country === 'string') {
    const hint = COUNTRY_HINTS[country.trim().toUpperCase()];
    if (hint) return hint;
  }
  return 'en';
}

/**
 * Preserve an existing explicit choice when new locale packs are introduced.
 * No redirect, cookie access, backend dependency, or automatic translation.
 */
export function isSupportedFrontendLocale(value) {
  return FRONTEND_LOCALES.includes(value);
}
