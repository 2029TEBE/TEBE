/** UI locale normalization. Language coverage is tracked separately. */
export const FRONTEND_LOCALES = Object.freeze([
  'ar','en-US','en-GB','bn','de','es','es-419','fil','fr','hi','id','it','ja','ko','pt-BR','pt-PT','ru','sw','tr','ur','vi','zh-CN','zh-TW',
]);
const CODES = new Map(FRONTEND_LOCALES.map(code => [code.toLowerCase(), code]));
export function normalizeFrontendLocale(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const value = input.trim().replaceAll('_','-').toLowerCase();
  if (CODES.has(value)) return CODES.get(value);
  if (value === 'en' || value.startsWith('en-')) return 'en-US';
  if (value.startsWith('ar-')) return 'ar';
  if (value === 'zh' || value === 'zh-hans' || value.startsWith('zh-hans-') || value === 'zh-sg') return 'zh-CN';
  if (value === 'zh-hant' || value.startsWith('zh-hant-') || value === 'zh-hk') return 'zh-TW';
  const base = value.split('-')[0];
  return CODES.get(base) ?? null;
}
export function chooseFrontendLocale({selected=null,saved=null,browserLanguages=[],country=null}={}) {
  for (const value of [selected,saved,...(Array.isArray(browserLanguages)?browserLanguages:[])]) {
    const normalized=normalizeFrontendLocale(value);
    if (normalized) return normalized;
  }
  const hints={SA:'ar',AE:'ar',QA:'ar',BH:'ar',KW:'ar',OM:'ar',DE:'de',CN:'zh-CN',TW:'zh-TW',FR:'fr',JP:'ja',GB:'en-GB',US:'en-US'};
  return hints[String(country??'').toUpperCase()] ?? 'en-US';
}
export function isSupportedFrontendLocale(value){return FRONTEND_LOCALES.includes(value);}
