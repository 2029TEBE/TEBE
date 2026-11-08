/** Type contract for the frontend-only locale resolver. */
export type FrontendLocale = 'en' | 'ar-SA' | 'de-DE' | 'zh-CN' | 'fr-FR' | 'ja-JP';
export const FRONTEND_LOCALES: readonly FrontendLocale[];
export function normalizeFrontendLocale(input: unknown): FrontendLocale | null;
export function chooseFrontendLocale(options?: {
  selected?: string | null;
  saved?: string | null;
  browserLanguages?: string[];
  country?: string | null;
}): FrontendLocale;
export function isSupportedFrontendLocale(value: string): value is FrontendLocale;
