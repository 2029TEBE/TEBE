/** Report export languages with reviewed document templates (not UI-only locales). */
export type ExportLanguage = 'en' | 'ar';
export const EXPORT_LANGUAGES = ['en', 'ar'] as const;
/**
 * Valid English/Arabic locale aliases are accepted for compatibility.
 * Other UI locales are explicitly unsupported until their board-pack copy is reviewed.
 * Undefined preserves historical English default for callers without ?lang.
 */
export function resolveExportLanguage(value: unknown): ExportLanguage | null {
  if (value == null || value === '') return 'en';
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replaceAll('_', '-').toLowerCase();
  if (normalized === 'en' || normalized === 'en-us' || normalized === 'en-gb') return 'en';
  if (normalized === 'ar' || normalized === 'ar-sa') return 'ar';
  return null;
}
