import { cookies } from 'next/headers';
import { normalizeFrontendLocale } from './frontend-locale.mjs';
import { uiLabel } from './ui-labels.mjs';
import { translator, type Lang, type T } from './i18n-dict';

export { translator, term, type Lang, type T } from './i18n-dict';

/** The language for this request. A cookie, so it survives a full page load. */
export async function getLang(): Promise<Lang> {
  // A selected frontend locale takes precedence over stale legacy cookies;
  // only Arabic renders with the shared backend-compatible Arabic dictionary.
  return (await getFrontendLocale()) === 'ar' ? 'ar' : 'en';
}

/** The common case in a server component: read the cookie, get the function. */
export async function tr(): Promise<T> {
  // Preserve the original shared EN/AR contract used by backend exports.
  // For additional UI locales, translate only catalogued frontend strings;
  // unavailable translations deliberately fall back to English.
  const locale = await getFrontendLocale();
  const lang: Lang = locale === 'ar' ? 'ar' : 'en';
  const legacy = translator(lang);
  return (english: string) => uiLabel(english, locale, legacy(english));
}

/**
 * Frontend display preference, intentionally separate from the legacy en/ar
 * translation/export contract. Existing getLang()/tr() remain unchanged.
 * An invalid new preference resolves safely to English; no auth/tenant effects.
 */
export async function getFrontendLocale(): Promise<import('./frontend-locale.mjs').FrontendLocale> {
  const jar = await cookies();
  const current = jar.get('pmo_locale')?.value;
  if (current !== undefined) {
    return normalizeFrontendLocale(current) ?? 'en-US';
  }
  return jar.get('pmo_lang')?.value === 'ar' ? 'ar' : 'en-US';
}
