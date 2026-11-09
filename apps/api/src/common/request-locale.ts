import type { Request, Response, NextFunction } from 'express';
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from '@pmo/contracts';

/**
 * Locale negotiation is presentation metadata only: authorization, tenant
 * context, stored enum values, API schemas and returned JSON remain invariant.
 * Do not translate arbitrary API response strings here.
 */
export function selectRequestLocale(
  cookieLocale: unknown,
  acceptLanguage: unknown,
): SupportedLocale {
  const explicit = normalizeLocale(cookieLocale);
  if (explicit) return explicit;
  if (typeof acceptLanguage !== 'string' || acceptLanguage.length > 512) return DEFAULT_LOCALE;

  const preferences: { language: string; quality: number; order: number }[] = [];
  for (const [order, item] of acceptLanguage.split(',').slice(0, 20).entries()) {
    const [rawTag, ...params] = item.trim().split(';');
    if (!rawTag || rawTag.length > 35) continue;
    let quality = 1;
    let bad = false;
    for (const raw of params) {
      const part = raw.trim();
      if (!part) continue;
      const m = /^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i.exec(part);
      if (!m) { bad = true; break; }
      quality = Number(m[1]);
    }
    if (!bad && quality > 0) preferences.push({ language: rawTag, quality, order });
  }
  preferences.sort((a, b) => b.quality - a.quality || a.order - b.order);
  for (const preference of preferences) {
    const normalized = normalizeLocale(preference.language);
    if (normalized) return normalized;
  }
  return DEFAULT_LOCALE;
}

/** Only trusted, server-parsed cookies and standard Accept-Language are used. */
export function requestLocaleMiddleware(req: Request, res: Response, next: NextFunction) {
  // res.locals is scoped to this request. It is never a global user or tenant setting.
  res.locals.epmoLocale = selectRequestLocale(req.cookies?.pmo_lang, req.headers['accept-language']);
  next();
}
