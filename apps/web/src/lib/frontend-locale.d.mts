export type FrontendLocale = 'ar' | 'en-US' | 'bn' | 'de' | 'es' | 'es-419' | 'fil' | 'fr' | 'hi' | 'id' | 'it' | 'ja' | 'ko' | 'pt-BR' | 'pt-PT' | 'ru' | 'sw' | 'tr' | 'ur' | 'vi' | 'zh-CN' | 'zh-TW';
export const FRONTEND_LOCALES: readonly FrontendLocale[];
export function normalizeFrontendLocale(input: unknown): FrontendLocale | null;
export function chooseFrontendLocale(options?: { selected?: string | null; saved?: string | null; browserLanguages?: string[]; country?: string | null }): FrontendLocale;
export function isSupportedFrontendLocale(value: string): value is FrontendLocale;
