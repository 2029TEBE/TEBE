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

/** Cookie preference first, then weighted Accept-Language; never trust tenant headers. */
export function selectRequestLocale(
  cookieLocale: unknown,
  acceptLanguage: unknown,
): SupportedLocale {
  const explicit = normalizeLocale(cookieLocale);
  if (explicit) return explicit;
  if (typeof acceptLanguage !== 'string' || acceptLanguage.length > 512) return DEFAULT_LOCALE;

  const preferences: { language: string; quality: number; order: number }[] = [];
  for (const [order, item] of acceptLanguage.split(',').slice(0, 20).entries()) {
    const [rawTag, ...params] = item.trim().split(';');
    if (!rawTag || rawTag.length > 35) continue;
    let quality = 1;
    let bad = false;
    for (const raw of params) {
      const part = raw.trim();
      if (!part) continue;
      const m = /^q=(0(?:\\.\\d{0,3})?|1(?:\\.0{0,3})?)$/i.exec(part);
      if (!m) { bad = true; break; }
      quality = Number(m[1]);
    }
    if (!bad && quality > 0) preferences.push({ language: rawTag, quality, order });
  }
  preferences.sort((a, b) => b.quality - a.quality || a.order - b.order);
  for (const preference of preferences) {
    const normalized = normalizeLocale(preference.language);
    if (normalized) return normalized;
  }
  return DEFAULT_LOCALE;
}
