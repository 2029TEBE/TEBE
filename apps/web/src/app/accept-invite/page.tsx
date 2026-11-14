import { UiText } from '@/components/UiLocale';
import { getLang, getFrontendLocale } from '@/lib/i18n';
import { navigationArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { InviteForm } from './InviteForm';
export const metadata = { title: 'Accept Invitation | The EPMO', other: { referrer: 'no-referrer' } };
export default async function AcceptInvitePage() {
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const labelFor = (en: string) => uiLabel(en, locale, navigationArabic(en));
  return <main style={{ maxWidth: 580, margin: '10vh auto', padding: 24 }} dir={locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr'}>
    <h1><UiText text={labelFor("Join The EPMO")} /></h1>
    <InviteForm lang={lang} />
  </main>;
}
