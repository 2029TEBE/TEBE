import { cookies } from 'next/headers';
import { normalizeFrontendLocale } from './frontend-locale.mjs';
import { translator, type Lang, type T } from './i18n-dict';

export { translator, term, type Lang, type T } from './i18n-dict';

/** The language for this request. A cookie, so it survives a full page load. */
export async function getLang(): Promise<Lang> {
  return (await cookies()).get('pmo_lang')?.value === 'ar' ? 'ar' : 'en';
}

/** The common case in a server component: read the cookie, get the function. */
export async function tr(): Promise<T> {
  return translator(await getLang());
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
    return normalizeFrontendLocale(current) ?? 'en';
  }
  return jar.get('pmo_lang')?.value === 'ar' ? 'ar-SA' : 'en';
}
