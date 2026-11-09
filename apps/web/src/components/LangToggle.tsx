'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The marketing site currently exposes English and Arabic. Keep these two
 * translated options selectable in the application while the shared backend
 * registers all six planned locales. Never display untranslated languages as
 * completed UI support.
 */
export function LangToggle({ ar }: { ar: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  function choose(locale: 'en' | 'ar') {
    if (locale === (ar ? 'ar' : 'en')) return;
    document.cookie = `pmo_lang=${locale}; path=/; max-age=31536000; samesite=lax`;
    // Existing server components use the same cookie; Arabic gets document RTL.
    start(() => router.refresh());
  }
  return (
    <label className="language-select">
      <span>{ar ? 'اللغة' : 'Language'}</span>
      <select aria-label={ar ? 'اختر اللغة' : 'Select language'}
              value={ar ? 'ar' : 'en'} disabled={pending}
              onChange={(event) => choose(event.target.value as 'en' | 'ar')}>
        <option value="en">English</option>
        <option value="ar">العربية</option>
      </select>
    </label>
  );
}
