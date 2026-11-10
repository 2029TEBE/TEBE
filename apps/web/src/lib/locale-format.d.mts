import type { FrontendLocale } from './frontend-locale.mjs';
export function presentationLocale(input: string | null | undefined): FrontendLocale;
export function directionForLocale(input: string | null | undefined): 'rtl' | 'ltr';
export function formatNumber(value: number, locale?: string, options?: Intl.NumberFormatOptions): string;
export function formatCurrency(value: number, currency?: string, locale?: string): string;
export function formatDate(value: string | number | Date, locale?: string, options?: Intl.DateTimeFormatOptions): string;
export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, locale?: string): string;
export function compareLocalizedValues(a: string | number | null, b: string | number | null, locale?: string, direction?: 'asc' | 'desc'): number;
