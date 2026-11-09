import { cookies, headers } from 'next/headers';
import { resolveRequestLocale, type SupportedLocale } from '@pmo/contracts';
import { translator, type Lang, type T } from './i18n-dict';

export { translator, term, type Lang, type T } from './i18n-dict';

/**
 * One shared locale policy with the API: saved selection takes precedence,
 * then Accept-Language, then English. No user or tenant data is changed.
 */
export async function getLocale(): Promise<SupportedLocale> {
  const jar = await cookies();
  const requestHeaders = await headers();
  return resolveRequestLocale(undefined, jar.get('pmo_lang')?.value, requestHeaders.get('accept-language'));
}

/**
 * Legacy screens render approved Arabic/English copy only. The selector can
 * retain all six preferences, but untranslated screens safely show English.
 */
export async function getLang(): Promise<Lang> {
  return (await getLocale()) === 'ar-SA' ? 'ar' : 'en';
}

export async function tr(): Promise<T> {
  return translator(await getLang());
}
