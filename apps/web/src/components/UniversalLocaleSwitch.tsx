'use client';
import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALE_REGISTRY, navigationArabic, type LocaleCode } from '@pmo/contracts';
import { chooseFrontendLocale } from '@/lib/frontend-locale.mjs';

/** Display language only. Never change pmo_session or other auth/tenant cookies. */
function persistSharedLocale(locale: string) {
  const liveApp = window.location.protocol === 'https:' &&
    window.location.hostname.toLowerCase() === 'app.theepmo.com';
  document.cookie = `epmo_site_locale=${encodeURIComponent(locale)}; path=/; max-age=31536000; samesite=lax` +
    (liveApp ? '; domain=theepmo.com; secure' : '');
}

/** One selector for all recognized TheOrg locales; untranslated labels fall back to English. */
export function UniversalLocaleSwitch({ locale }: { locale: LocaleCode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fallback = !['en-US', 'en-GB', 'ar'].includes(locale);
  const label = locale === 'ar' ? navigationArabic('Interface language') : 'Interface language';

  useEffect(() => {
    const hasPreference = document.cookie.split(';').some(part =>
      /^\s*(pmo_locale|pmo_lang)=/.test(part));
    if (hasPreference) return;
    const languages = navigator.languages?.length ? Array.from(navigator.languages) : [navigator.language];
    const detected = chooseFrontendLocale({ browserLanguages: languages });
    if (detected === 'en-US') return;
    persistSharedLocale(detected);
    document.cookie = `pmo_locale=${encodeURIComponent(detected)}; path=/; max-age=31536000; samesite=lax`;
    document.cookie = `pmo_lang=${detected === 'ar' ? 'ar' : 'en'}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  function setLocale(next: string) {
    if (!LOCALE_REGISTRY.some(item => item.code === next)) return;
    persistSharedLocale(next);
    document.cookie = `pmo_locale=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;
    document.cookie = `pmo_lang=${next === 'ar' ? 'ar' : 'en'}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return <div className="locale-picker">
    <label htmlFor="epmo-header-locale" className="sr-only">{label}</label>
    <span aria-hidden="true">🌐</span>
    <select id="epmo-header-locale" aria-label={label} value={locale}
      disabled={pending} onChange={event => setLocale(event.target.value)}>
      {LOCALE_REGISTRY.map(item =>
        <option key={item.code} value={item.code}>{item.name}</option>)}
    </select>
    {fallback && <span className="dim" aria-live="polite"
      title="Translations are being reviewed; missing strings appear in English.">
      English fallback
    </span>}
  </div>;
}
