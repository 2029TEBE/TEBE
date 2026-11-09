import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localeDirection, resolveRequestLocale } from '@pmo/contracts';

/**
 * Authenticated capability discovery for the unified frontend language switcher.
 * Pure metadata: never reads or changes user/workspace records.
 * Actual translated copy is owned by the shared dictionary, not this route.
 */
@Controller('api/v1/i18n')
export class LocaleController {
  @Get('locales')
  list(@Req() req: Request) {
    const selected = resolveRequestLocale(
      req.get('x-epmo-locale'),
      req.cookies?.pmo_lang,
      req.get('accept-language'),
    );
    return {
      defaultLocale: DEFAULT_LOCALE,
      selectedLocale: selected,
      direction: localeDirection(selected),
      locales: SUPPORTED_LOCALES,
    };
  }
}
