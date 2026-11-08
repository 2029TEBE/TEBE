'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { chooseFrontendLocale, type FrontendLocale } from '@/lib/frontend-locale.mjs';

/**
 * One locale selector for the one authenticated app.
 * Non-English/Arabic catalogs are pending; English is rendered until verified.
 * Keep the legacy pmo_lang cookie so existing EN/AR screens and exports work.
 */
const OPTIONS: { value: FrontendLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ar-SA', label: 'العربية' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'ja-JP', label: '日本語' },
];

export function UniversalLocaleSwitch({ locale }: { locale: FrontendLocale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fallback = locale !== 'en' && locale !== 'ar-SA';
  const arabic = locale === 'ar-SA';
  const label = arabic ? 'لغة الواجهة' : 'Interface language';

  // First visit only: browser preference. An existing explicit or legacy
  // choice always wins. Country hints are deliberately not inferred here.
  useEffect(() => {
    const hasPreference = document.cookie.split(';').some((part) =>
      /^\\s*(pmo_locale|pmo_lang)=/.test(part));
    if (hasPreference) return;
    const browserLanguages = navigator.languages?.length
      ? Array.from(navigator.languages)
      : [navigator.language];
    const detected = chooseFrontendLocale({ browserLanguages });
    if (detected === 'en') return;
    document.cookie = `pmo_locale=${encodeURIComponent(detected)}; path=/; max-age=31536000; samesite=lax`;
    document.cookie = `pmo_lang=${detected === 'ar-SA' ? 'ar' : 'en'}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  function setLocale(next: string) {
    if (!OPTIONS.some((option) => option.value === next)) return;
    // SameSite cookies, scoped to frontend host. Never touch session/tenant.
    document.cookie = `pmo_locale=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;
    document.cookie = `pmo_lang=${next === 'ar-SA' ? 'ar' : 'en'}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <div className="locale-picker">
      <label htmlFor="epmo-header-locale" className="sr-only">{label}</label>
      <span aria-hidden="true">🌐</span>
      <select id="epmo-header-locale"
              aria-label={label}
              value={locale}
              disabled={pending}
              onChange={(event) => setLocale(event.target.value)}>
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {fallback && <span className="dim" aria-live="polite" title="Translations are being reviewed; English is shown until ready.">
        English fallback
      </span>}
    </div>
  );
}
