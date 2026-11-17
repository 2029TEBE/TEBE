import { Page } from '@/components/Page';
import { getLang } from '@/lib/i18n';
import { getSession } from '@/lib/api';
import { GaizVerificationPanel } from '@/components/GaizVerificationPanel';

export default async function GaizPage() {
  const lang = await getLang(); const ar = lang === 'ar';
  const session = await getSession();
  return <Page title={ar ? 'GIZE AI — معاينة التحقق' : 'GIZE AI — Verification preview'}
    sub={ar ? 'تحقق آمن للتوقيع ضمن حدود المستأجر، دون استيراد أي سجلات.'
      : 'Tenant-scoped signature verification preview. No data is imported.'}>
    {!session.authenticated ? <p>{ar ? 'يرجى تسجيل الدخول.' : 'Sign in required.'}</p>
      : <GaizVerificationPanel ar={ar} />}
    <p className="dim">{ar
      ? 'تُقرأ الملفات التجريبية القديمة GAIZ1 وGAIZ2 لأغراض التوافق فقط؛ صيغة ‎.GAZE الجديدة لم تُعتمد بعد.'
      : 'Experimental GAIZ1/GAIZ2 wire identifiers remain for legacy compatibility. The final .GAZE file format is not yet ratified.'}</p>
  </Page>;
}
