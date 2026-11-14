import { UiText } from '@/components/UiLocale';
import Link from 'next/link';
import { getLang, getFrontendLocale } from '@/lib/i18n';
import { navigationArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { RecoveryRequestForm } from './RecoveryRequestForm';
export const metadata = { title: 'Password recovery | The EPMO', robots: { index: false } };
export default async function ForgotPasswordPage() {
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const labelFor = (en: string) => uiLabel(en, locale, navigationArabic(en));
  return <main className="authwrap" dir={locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr'}>
    <section className="authpanel" style={{ maxWidth: 510 }}>
      <h1><UiText text={labelFor("Forgot your password?")} /></h1>
      <p><UiText text={labelFor("We will email a 30-minute recovery link if an active account exists.")} /></p>
      <RecoveryRequestForm lang={lang} />
      <p><Link href="/login"><UiText text={labelFor("Back to sign in")} /></Link></p>
    </section>
  </main>;
}
