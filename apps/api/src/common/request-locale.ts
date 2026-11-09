import type { Request, Response, NextFunction } from 'express';
import { selectRequestLocale } from '@pmo/contracts';

/**
 * Locale negotiation is presentation metadata only: authorization, tenant
 * context, stored enum values, API schemas and returned JSON remain invariant.
 * Do not translate arbitrary API response strings here.
 *
 * res.locals is scoped to this request; no shared global or persisted tenant
 * preference is mutated.
 */
export function requestLocaleMiddleware(req: Request, res: Response, next: NextFunction) {
  res.locals.epmoLocale = selectRequestLocale(req.cookies?.pmo_lang, req.headers['accept-language']);
  next();
}
