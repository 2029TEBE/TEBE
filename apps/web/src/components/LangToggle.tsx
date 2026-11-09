'use client';
import { useTransition } from 'react';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@pmo/contracts';

/**
 * Universal locale switcher. All six options are saved, but languages without
 * approved dictionaries intentionally render English until translations ship.
 * Locale is presentation-only: no account, tenant or API permission is changed.
 */
export function LangToggle({ locale }: { locale: SupportedLocale }) {
  const [pending, start] = useTransition();

  function selectLocale(next: string) {
    if (!SUPPORTED_LOCALES.some(item => item.code === next) || next === locale) return;
    document.cookie = `pmo_lang=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;
    // The document's language and direction are generated on the server;
    // a full navigation ensures <html lang> and <html dir> stay synchronized.
    start(() => { window.location.reload(); });
  }

  return (
    <label className="locale-switcher" title="Choose interface language">
      <select aria-label="Interface language" value={locale} disabled={pending}
              onChange={(event) => selectLocale(event.target.value)}>
        {SUPPORTED_LOCALES.map(item => (
          <option key={item.code} value={item.code}>{item.nativeName}{item.code !== 'en' && item.code !== 'ar-SA' ? ' (English fallback)' : ''}</option>
        ))}
      </select>
    </label>
  );
}
