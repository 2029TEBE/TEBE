/**
 * THE EPMO's canonical locale registry. 23 TheOrg/Chromium locale variants
 * represent 19 language families. Registry membership != translated coverage.
 * English remains the source; all unverified strings fall back to English.
 */
export const LOCALE_REGISTRY = [
  { code: 'ar', name: 'العربية', language: 'ar', direction: 'rtl' },
  { code: 'en-US', name: 'English (US)', language: 'en', direction: 'ltr' },
  { code: 'en-GB', name: 'English (UK)', language: 'en', direction: 'ltr' },
  { code: 'bn', name: 'বাংলা', language: 'bn', direction: 'ltr' },
  { code: 'de', name: 'Deutsch', language: 'de', direction: 'ltr' },
  { code: 'es', name: 'Español', language: 'es', direction: 'ltr' },
  { code: 'es-419', name: 'Español (Latinoamérica)', language: 'es', direction: 'ltr' },
  { code: 'fil', name: 'Filipino', language: 'fil', direction: 'ltr' },
  { code: 'fr', name: 'Français', language: 'fr', direction: 'ltr' },
  { code: 'hi', name: 'हिन्दी', language: 'hi', direction: 'ltr' },
  { code: 'id', name: 'Bahasa Indonesia', language: 'id', direction: 'ltr' },
  { code: 'it', name: 'Italiano', language: 'it', direction: 'ltr' },
  { code: 'ja', name: '日本語', language: 'ja', direction: 'ltr' },
  { code: 'ko', name: '한국어', language: 'ko', direction: 'ltr' },
  { code: 'pt-BR', name: 'Português (Brasil)', language: 'pt', direction: 'ltr' },
  { code: 'pt-PT', name: 'Português (Portugal)', language: 'pt', direction: 'ltr' },
  { code: 'ru', name: 'Русский', language: 'ru', direction: 'ltr' },
  { code: 'sw', name: 'Kiswahili', language: 'sw', direction: 'ltr' },
  { code: 'tr', name: 'Türkçe', language: 'tr', direction: 'ltr' },
  { code: 'ur', name: 'اردو', language: 'ur', direction: 'rtl' },
  { code: 'vi', name: 'Tiếng Việt', language: 'vi', direction: 'ltr' },
  { code: 'zh-CN', name: '简体中文', language: 'zh', direction: 'ltr' },
  { code: 'zh-TW', name: '繁體中文', language: 'zh', direction: 'ltr' },
] as const;

export type LocaleCode = typeof LOCALE_REGISTRY[number]['code'];
export const DEFAULT_LOCALE: LocaleCode = 'en-US';
export const LOCALE_CODES = LOCALE_REGISTRY.map(({ code }) => code);
export function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(value);
}
export function localeDirection(value: string): 'ltr' | 'rtl' {
  return LOCALE_REGISTRY.find(({ code }) => code === value)?.direction ?? 'ltr';
}
export function localeForIntl(value: string): string {
  return isLocaleCode(value) ? value : DEFAULT_LOCALE;
}
/** Browser locale negotiation does not equate to translation completeness. */
export function resolveLocale(value: unknown): LocaleCode {
  if (typeof value !== 'string') return DEFAULT_LOCALE;
  const v = value.trim().replaceAll('_', '-').toLowerCase();
  const exact = LOCALE_CODES.find(code => code.toLowerCase() === v);
  if (exact) return exact;
  if (v === 'ar-sa' || v.startsWith('ar-')) return 'ar';
  if (v === 'en') return 'en-US';
  if (v.startsWith('en-gb')) return 'en-GB';
  if (v.startsWith('en-')) return 'en-US';
  if (v === 'zh' || v === 'zh-hans' || v.startsWith('zh-hans-') || v === 'zh-sg') return 'zh-CN';
  if (v === 'zh-hant' || v.startsWith('zh-hant-') || v === 'zh-hk') return 'zh-TW';
  const base = v.split('-')[0];
  return LOCALE_CODES.find(code => code.toLowerCase() === base) ?? DEFAULT_LOCALE;
}
