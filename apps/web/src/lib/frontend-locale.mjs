/** UI locale normalization. Language coverage is tracked separately. */
export const FRONTEND_LOCALES = Object.freeze([
  'en-US','ar','bn','de','es','es-419','fil','fr','hi','id','it','ja','ko','pt-BR','pt-PT','ru','sw','tr','ur','vi','zh-CN','zh-TW',
]);
const CODES = new Map(FRONTEND_LOCALES.map(code => [code.toLowerCase(), code]));
export function normalizeFrontendLocale(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const value = input.trim().replaceAll('_','-').toLowerCase();
  if (CODES.has(value)) return CODES.get(value);
  // Preserve known regional variants even when the browser supplies extra subtags.
  if (value === 'en-gb' || value.startsWith('en-gb-')) return 'en-US';
  if (value === 'en' || value.startsWith('en-')) return 'en-US';
  if (value === 'es-419' || value.startsWith('es-419-')) return 'es-419';
  if (value === 'pt-br' || value.startsWith('pt-br-')) return 'pt-BR';
  if (value === 'pt-pt' || value.startsWith('pt-pt-')) return 'pt-PT';
  if (value.startsWith('ar-')) return 'ar';
  // Script and territory aliases must survive additional browser subtags.
  if (value === 'zh-hant' || value.startsWith('zh-hant-') || value === 'zh-tw' || value.startsWith('zh-tw-') || value === 'zh-hk' || value.startsWith('zh-hk-') || value === 'zh-mo' || value.startsWith('zh-mo-')) return 'zh-TW';
  if (value === 'zh' || value === 'zh-hans' || value.startsWith('zh-hans-') || value === 'zh-cn' || value.startsWith('zh-cn-') || value === 'zh-sg' || value.startsWith('zh-sg-')) return 'zh-CN';
  const base = value.split('-')[0];
  return CODES.get(base) ?? null;
}
export function chooseFrontendLocale({selected=null,saved=null,browserLanguages=[],country=null}={}) {
  for (const value of [selected,saved,...(Array.isArray(browserLanguages)?browserLanguages:[])]) {
    const normalized=normalizeFrontendLocale(value);
    if (normalized) return normalized;
  }
  const hints={SA:'ar',AE:'ar',QA:'ar',BH:'ar',KW:'ar',OM:'ar',DE:'de',CN:'zh-CN',TW:'zh-TW',FR:'fr',JP:'ja',GB:'en-US',US:'en-US'};
  return hints[String(country??'').toUpperCase()] ?? 'en-US';
}
export function isSupportedFrontendLocale(value){return FRONTEND_LOCALES.includes(value);}
