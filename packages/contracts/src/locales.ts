/**
 * Canonical locale contract shared by the API and web.
 * English is the source/fallback. Locale selection never affects authorisation,
 * tenant identity, database keys, or persisted values.
 */
export const SUPPORTED_LOCALES = [
  { code: 'en', nativeName: 'English', direction: 'ltr' },
  { code: 'ar-SA', nativeName: 'العربية', direction: 'rtl' },
  { code: 'de-DE', nativeName: 'Deutsch', direction: 'ltr' },
  { code: 'zh-CN', nativeName: '简体中文', direction: 'ltr' },
  { code: 'fr-FR', nativeName: 'Français', direction: 'ltr' },
  { code: 'ja-JP', nativeName: '日本語', direction: 'ltr' },
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]['code'];
export type LocaleDirection = 'ltr' | 'rtl';
export const DEFAULT_LOCALE: SupportedLocale = 'en';

const aliases: Readonly<Record<string, SupportedLocale>> = {
  en: 'en', 'en-us': 'en', 'en-gb': 'en',
  ar: 'ar-SA', 'ar-sa': 'ar-SA',
  de: 'de-DE', 'de-de': 'de-DE',
  'zh-cn': 'zh-CN', 'zh-hans': 'zh-CN', 'zh-hans-cn': 'zh-CN',
  fr: 'fr-FR', 'fr-fr': 'fr-FR',
  ja: 'ja-JP', 'ja-jp': 'ja-JP',
};

/** Only explicitly supported locales and safe aliases are accepted. */
export function normalizeLocale(input: unknown): SupportedLocale | null {
  if (typeof input !== 'string' || input.length > 35) return null;
  const key = input.trim().toLowerCase();
  return Object.hasOwn(aliases, key) ? aliases[key] : null;
}

/** Honor quality weights and original order. Reject oversized/untrusted input. */
export function localeFromAcceptLanguage(header: unknown): SupportedLocale | null {
  if (typeof header !== 'string' || header.length > 512) return null;
  const choices = header.split(',').slice(0, 20).map((entry, index) => {
    const match = /^\s*([A-Za-z]{2,8}(?:-[A-Za-z]{2,8}){0,3})(?:\s*;\s*q\s*=\s*(0(?:\.\d{1,3})?|1(?:\.0{1,3})?))?\s*$/.exec(entry);
    if (!match) return null;
    const locale = normalizeLocale(match[1]);
    const q = match[2] === undefined ? 1 : Number(match[2]);
    return locale && q > 0 ? { locale, q, index } : null;
  }).filter((item): item is { locale: SupportedLocale; q: number; index: number } => item !== null);
  choices.sort((a, b) => b.q - a.q || a.index - b.index);
  return choices[0]?.locale ?? null;
}

/**
 * Explicit selector > app cookie > Accept-Language > English.
 * Invalid values cannot escape this six-code registry.
 */
export function resolveRequestLocale(
  explicit: unknown,
  cookie: unknown,
  acceptLanguage: unknown,
): SupportedLocale {
  return normalizeLocale(explicit) ??
    normalizeLocale(cookie) ??
    localeFromAcceptLanguage(acceptLanguage) ??
    DEFAULT_LOCALE;
}

export function localeDirection(locale: SupportedLocale): LocaleDirection {
  return locale === 'ar-SA' ? 'rtl' : 'ltr';
}
