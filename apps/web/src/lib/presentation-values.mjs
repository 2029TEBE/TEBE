import { presentationLocale } from './locale-format.mjs';

/**
 * Frontend presentation values only. Keep persisted numbers and API formats
 * unchanged, and keep the EN/AR backend export language contract separate.
 */
const displayLocale = (locale = 'en') => {
  if (locale === 'en') return 'en-GB';
  const value = presentationLocale(locale);
  // Maintain Saudi Gregorian and Latin-digit conventions for business dates.
  return value === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : value;
};
const finite = n => typeof n === 'number' && Number.isFinite(n);

export const money = (value, locale = 'en') =>
  !finite(value) ? '—' : new Intl.NumberFormat(displayLocale(locale), {
    notation: 'compact', maximumFractionDigits: 1,
  }).format(value);

export const num = (value, digits = 0, locale = 'en') =>
  !finite(value) ? '—' : new Intl.NumberFormat(displayLocale(locale), {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);

export const pct = (value, locale = 'en') =>
  !finite(value) ? '—' : `${new Intl.NumberFormat(displayLocale(locale), {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}%`;

export const when = (value, locale = 'en') => {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(displayLocale(locale), {
    day: 'numeric', month: 'short', year: '2-digit',
  }).format(date);
};

export const ago = (value, locale = 'en') => {
  if (!value) return '—';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  const rtf = new Intl.RelativeTimeFormat(displayLocale(locale), { numeric: 'auto' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  if (minutes < 1440) return rtf.format(-Math.floor(minutes / 60), 'hour');
  return rtf.format(-Math.floor(minutes / 1440), 'day');
};
