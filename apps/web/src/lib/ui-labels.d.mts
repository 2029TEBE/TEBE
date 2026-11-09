import type { FrontendLocale } from './frontend-locale.mjs';
export const UI_LABELS: Readonly<Record<string, Partial<Record<FrontendLocale, string>>>>;
export function uiLabel(english: string, locale: FrontendLocale, legacyArabic?: string | null): string;
export function uiLabelCoverage(englishLabels: string[], locale: FrontendLocale): { total: number; translated: number; missing: string[] };
