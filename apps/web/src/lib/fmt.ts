import { presentationLocale } from './locale-format.mjs';

/**
 * Presentation formatters: callers pass the selected frontend locale, never
 * the legacy EN/AR export language. Defaults retain the original English UI.
 * Invalid or absent numbers/dates are missing data, not a value to invent.
 */
const resolvedLocale = (locale: string) => {
  const normalized = presentationLocale(locale);
  // Saudi business pages previously used Gregorian calendar and Latin digits.
  return normalized === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : normalized;
};
const validNumber = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n);

export const money = (n: number | null | undefined, locale = 'en') =>
  !validNumber(n) ? '—' : new Intl.NumberFormat(resolvedLocale(locale), {
    notation: 'compact', maximumFractionDigits: 1,
  }).format(n);

export const num = (n: number | null | undefined, d = 0, locale = 'en') =>
  !validNumber(n) ? '—' : new Intl.NumberFormat(resolvedLocale(locale), {
    minimumFractionDigits: d, maximumFractionDigits: d,
  }).format(n);

/*
 * Guards NaN and Infinity, not just null. An empty workspace makes 0/0;
 * presenting NaN% as a real financial indicator is misleading.
 */
export const pct = (n: number | null | undefined, locale = 'en') =>
  !validNumber(n) ? '—' : `${new Intl.NumberFormat(resolvedLocale(locale), {
    maximumFractionDigits: 0,
  }).format(Math.round(n))}%`;

export const when = (s: string | null | undefined, locale = 'en') => {
  if (!s) return '—';
  const date = new Date(s);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(resolvedLocale(locale), {
    day: 'numeric', month: 'short', year: '2-digit',
  }).format(date);
};

export const ago = (s: string | null | undefined, locale = 'en') => {
  if (!s) return '—';
  const value = new Date(s).getTime();
  if (!Number.isFinite(value)) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60000));
  const rtf = new Intl.RelativeTimeFormat(resolvedLocale(locale), { numeric: 'auto' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  if (minutes < 1440) return rtf.format(-Math.floor(minutes / 60), 'hour');
  return rtf.format(-Math.floor(minutes / 1440), 'day');
};
