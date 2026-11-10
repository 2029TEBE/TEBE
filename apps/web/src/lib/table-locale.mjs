/** Backwards-compatible table helpers, now shared across all six locales. */
import { compareLocalizedValues, formatNumber } from './locale-format.mjs';

export function compareTableValues(a, b, locale = 'en', direction = 'asc') {
  return compareLocalizedValues(a, b, locale, direction);
}

export function formatTableCount(n, locale = 'en') {
  return formatNumber(n, locale);
}
