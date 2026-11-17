import { validateStudioDefinition, LOCALE_CODES, type StudioDefinition } from '@pmo/contracts';

/** Pure publication diagnostics; never auto-translates and never approves. */
export function studioPublicationReadiness(
  definition: StudioDefinition,
  requiredLocales: readonly string[]=LOCALE_CODES,
): { publishable:boolean; missing:string[]; requiredLocales:readonly string[] } {
  const errors=validateStudioDefinition(definition,requiredLocales);
  return {publishable:errors.length===0,missing:errors,requiredLocales};
}
