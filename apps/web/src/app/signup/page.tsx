import Link from 'next/link';
import { getLang } from '@/lib/i18n';

export const metadata = { title: 'Request access · The EPMO' };

/**
 * Independent public route for the currently deployed application line.
 * Not self-service registration: no tenant, user or billing mutation here.
 * Invite email remains optional until inbound mail is proven operational.
 */
export default async function SignupPage() {
  const ar = (await getLang()) === 'ar';
  const mailboxVerified = process.env.EPMO_SIGNUP_EMAIL_READY === 'true';
  const mailto = 'mailto:info@theepmo.com?subject=THE%20EPMO%20workspace%20invitation%20request';
  return (
    <div className="authwrap" dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'en'}>
      <main className="authpanel">
        <div className="brand" style={{ marginBlockEnd: 24 }}>
          <span className="glyph">E</span>
          <span className="wordmark">{ar ? 'المكتب التنفيذي لإدارة المشاريع' : 'The EPMO'}</span>
        </div>
        <h1>{ar ? 'طلب الوصول إلى مساحة عمل' : 'Request workspace access'}</h1>
        <p className="sub">{ar
          ? 'إنشاء الحسابات الجديدة عن طريق الدعوة فقط. التسجيل الذاتي والدفع غير متاحين حاليًا.'
          : 'New workspaces are invitation-only. Self-service registration and payments are not available yet.'}</p>
        {mailboxVerified ? (
          <a className="btn wide" href={mailto}>
            {ar ? 'إرسال طلب دعوة' : 'Email a workspace access request'}
          </a>
        ) : (
          <p role="status" className="dim">{ar
            ? 'طلبات الدعوة عبر البريد الإلكتروني متوقفة مؤقتًا حتى اكتمال التحقق من خدمة البريد.'
            : 'Email-based invitation requests are temporarily unavailable while mailbox delivery is being verified.'}</p>
        )}
        <p className="dim">{ar
          ? 'لا ترسل كلمات المرور أو بيانات الدفع.'
          : 'Never send passwords or payment card information.'}</p>
        <p><Link href="/login">{ar ? 'لديك حساب؟ سجّل الدخول' : 'Already have an account? Sign in'}</Link></p>
        <p><Link href="https://theepmo.com/">{ar ? 'العودة إلى الموقع الرئيسي' : 'Return to the main website'}</Link></p>
      </main>
    </div>
  );
}
