import { UiText } from '@/components/UiLocale';
import { getLang, getFrontendLocale } from '@/lib/i18n';
import { navigationArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { ResetPasswordForm } from './ResetPasswordForm';
// The bearer token lives in a URL fragment, not server logs, and must never
// be shared in a Referer header even if a future page adds external resources.
export const metadata = { title: 'Reset password | The EPMO', robots: { index: false },
  other: { referrer: 'no-referrer' } };
export default async function ResetPasswordPage() {
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const labelFor = (en: string) => uiLabel(en, locale, navigationArabic(en));
  return <main className="authwrap" dir={locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr'}>
    <section className="authpanel" style={{ maxWidth: 510 }}>
      <h1><UiText text={labelFor("Choose a new password")} /></h1>
      <ResetPasswordForm lang={lang} />
    </section>
  </main>;
}
