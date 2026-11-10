import type { FrontendLocale } from './frontend-locale.mjs';
export const UI_LABELS: Readonly<Record<string, Partial<Record<FrontendLocale | 'ar-SA' | 'de-DE' | 'fr-FR' | 'ja-JP', string>>>>;
export function catalogLocale(locale: string): string;
export function uiLabel(english: string, locale: string, legacyArabic?: string | null): string;
export function translationPlaceholders(value: string): string[];
export function translationHasMatchingPlaceholders(english: string, translated: string): boolean;
export function uiLabelCoverage(
  englishLabels: string[],
  locale: string,
  legacyArabic?: Record<string,string>,
): { total: number; translated: number; missing: string[]; invalidPlaceholders: string[] };
