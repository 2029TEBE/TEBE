/**
 * Unified presentation formatting for the six approved THE EPMO locales.
 * Identifiers, API values, and persisted database records remain locale-neutral.
 * Chromium/Electron .pak locale files are NOT application translation catalogs.
 */
import { normalizeFrontendLocale } from './frontend-locale.mjs';

export function presentationLocale(input) {
  return normalizeFrontendLocale(input) ?? 'en-US';
}

export function directionForLocale(input) {
  return presentationLocale(input) === 'ar' || presentationLocale(input) === 'ur' ? 'rtl' : 'ltr';
}

export function formatNumber(value, locale = 'en', options = {}) {
  return new Intl.NumberFormat(presentationLocale(locale), options).format(value);
}

export function formatCurrency(value, currency = 'SAR', locale = 'en') {
  return formatNumber(value, locale, { style: 'currency', currency });
}

export function formatDate(value, locale = 'en', options = { dateStyle: 'medium' }) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' :
    new Intl.DateTimeFormat(presentationLocale(locale), options).format(date);
}

export function formatRelativeTime(value, unit, locale = 'en') {
  return new Intl.RelativeTimeFormat(presentationLocale(locale), { numeric: 'auto' })
    .format(value, unit);
}

export function compareLocalizedValues(a, b, locale = 'en', direction = 'asc') {
  // Missing values sort last in both directions.
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const factor = direction === 'desc' ? -1 : 1;
  const result = typeof a === 'number' && typeof b === 'number'
    ? a - b
    : new Intl.Collator(presentationLocale(locale), { numeric: true, sensitivity: 'base' })
      .compare(String(a), String(b));
  return factor * result;
}
