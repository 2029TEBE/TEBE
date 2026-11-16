import { Page } from '@/components/Page';
import { getLang } from '@/lib/i18n';
import { getSession } from '@/lib/api';
import { GaizVerificationPanel } from '@/components/GaizVerificationPanel';

export default async function GaizPage() {
  const lang = await getLang(); const ar = lang === 'ar';
  const session = await getSession();
  return <Page title={ar ? 'التحقق من GAIZ' : 'GAIZ Shield — Verification preview'}
    sub={ar ? 'تحقق آمن للتوقيع ضمن حدود المستأجر، دون استيراد أي سجلات.'
      : 'Tenant-scoped signature verification preview. No data is imported.'}>
    {!session.authenticated ? <p>{ar ? 'يرجى تسجيل الدخول.' : 'Sign in required.'}</p>
      : <GaizVerificationPanel ar={ar} />}
  </Page>;
}
