import { Page } from '@/components/Page';
import { getLang } from '@/lib/i18n';
import { getSession } from '@/lib/api';
import { GaizVerificationPanel } from '@/components/GaizVerificationPanel';

export default async function GaizPage() {
  const lang = await getLang(); const ar = lang === 'ar';
  const session = await getSession();
  return <Page title={ar ? 'التحقق من ‎GIZE AI' : 'GIZE AI — Verification preview'}
    sub={ar ? 'تحقق آمن للتوقيع ضمن حدود المستأجر، دون استيراد أي سجلات.'
      : 'Tenant-scoped signature verification preview. No data is imported.'}>
    {!session.authenticated ? <p>{ar ? 'يرجى تسجيل الدخول.' : 'Sign in required.'}</p>
      : <GaizVerificationPanel ar={ar} />}
    <p className="dim">{ar
      ? 'تُقرأ الملفات التجريبية القديمة GAIZ1 وGAIZ2 لأغراض التوافق فقط؛ صيغة الملفات المستقبلية لمنتج GIZE AI لم تُعتمد بعد.'
      : 'Experimental GAIZ1/GAIZ2 wire identifiers remain for legacy compatibility. A future GIZE AI file format is not yet ratified.'}</p>
  </Page>;
}
