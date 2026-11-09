/**
 * THE EPMO locale registry. English is the source language.
 * Locale selection never changes tenant identity, RBAC, database values or IDs.
 * The existing Word/PowerPoint/Excel catalogs remain en/ar until their
 * translations are independently added and tested.
 */
export const SUPPORTED_LOCALES = ['en', 'ar-SA', 'de-DE', 'zh-CN', 'fr-FR', 'ja-JP'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const LOCALE_METADATA: Readonly<Record<SupportedLocale, {
  name: string; nativeName: string; direction: 'ltr' | 'rtl';
}>> = Object.freeze({
  en: { name: 'English', nativeName: 'English', direction: 'ltr' },
  'ar-SA': { name: 'Arabic (Saudi Arabia)', nativeName: 'العربية', direction: 'rtl' },
  'de-DE': { name: 'German (Germany)', nativeName: 'Deutsch', direction: 'ltr' },
  'zh-CN': { name: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr' },
  'fr-FR': { name: 'French (France)', nativeName: 'Français', direction: 'ltr' },
  'ja-JP': { name: 'Japanese (Japan)', nativeName: '日本語', direction: 'ltr' },
});

/** Canonical BCP-47 matching, including legacy en/ar preference cookies. */
export function normalizeLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== 'string' || value.length > 35) return null;
  const tag = value.trim().replace(/_/g, '-').toLowerCase();
  if (tag === 'en' || tag.startsWith('en-')) return 'en';
  if (tag === 'ar' || tag.startsWith('ar-')) return 'ar-SA';
  if (tag === 'de' || tag.startsWith('de-')) return 'de-DE';
  if (tag === 'zh' || tag === 'zh-cn' || tag === 'zh-hans' ||
      tag.startsWith('zh-hans-')) return 'zh-CN';
  if (tag === 'fr' || tag.startsWith('fr-')) return 'fr-FR';
  if (tag === 'ja' || tag.startsWith('ja-')) return 'ja-JP';
  return null;
}

export function localeDirection(locale: SupportedLocale): 'ltr' | 'rtl' {
  return LOCALE_METADATA[locale].direction;
}
