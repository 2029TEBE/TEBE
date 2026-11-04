import Link from 'next/link';
import { getLang } from '@/lib/i18n';

export const metadata = { title: 'Request workspace access · The EPMO', robots: { index: false, follow: false } };

/**
 * Public access handoff while self-service account provisioning is not released.
 * No form may create a tenant or claim payment/activation here: invitations and
 * module entitlements remain verified by authenticated server-side flows.
 */
export default async function SignupPage() {
  const ar = (await getLang()) === 'ar';
  const email = 'info@theepmo.com';
  const emailReady = process.env.EPMO_SIGNUP_EMAIL_READY === 'true';
  const requestAddress = 'mailto:info@theepmo.com?subject=The%20EPMO%20workspace%20access%20request';

  return (
    <div className="authwrap" dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'en'}>
      <main className="authpanel">
        <div className="brand" style={{ padding: 0, marginBlockEnd: 26 }}>
          <span className="glyph">E</span>
          <span className="wordmark">{ar ? 'المكتب التنفيذي لإدارة المشاريع' : 'The EPMO'}</span>
        </div>
        <h1>{ar ? 'طلب الوصول إلى مساحة عمل' : 'Request workspace access'}</h1>
        <p className="sub">
          {ar
            ? 'إنشاء الحسابات الجديدة متاح حاليًا عن طريق الدعوة فقط. التسجيل الذاتي والدفع للاشتراك الأول غير متاحين بعد.'
            : 'New accounts are currently invitation-only. Self-service registration and first-subscription checkout are not available yet.'}
        </p>
        <div className="authform">
          {emailReady ? (
            <a className="btn wide" href={requestAddress}>
              {ar ? 'طلب دعوة عبر البريد الإلكتروني' : 'Email a workspace access request'}
            </a>
          ) : (
            <p className="dim" role="status">
              {ar ? 'طلبات الدعوة عبر البريد الإلكتروني غير متاحة مؤقتًا حتى التحقق من استقبال الرسائل.' : 'Email invitation requests are temporarily unavailable until inbox delivery is verified.'}
            </p>
          )}
          <p className="dim">
            {ar
              ? 'اذكر اسم المؤسسة والبريد الإلكتروني للتواصل. لا ترسل كلمات المرور أو معلومات البطاقة.'
              : 'Include your organization name and contact email. Never send a password or card information.'}
          </p>
          {emailReady && (
            <p className="dim">
              {ar ? 'البريد الإلكتروني للتواصل:' : 'Contact address:'}{' '}
              <a href={`mailto:${email}`}>{email}</a>
            </p>
          )}
          <Link href="/login">{ar ? 'لديك حساب؟ سجّل الدخول' : 'Already have an account? Sign in'}</Link>
          <Link href="/forgot-password">{ar ? 'تحتاج إلى استعادة كلمة المرور؟' : 'Need to recover your password?'}</Link>
        </div>
      </main>
      <aside className="authside">
        <blockquote>
          {ar
            ? 'يُفعّل الوصول إلى الخدمات المدفوعة فقط بعد إقرار الخادم بحالة الاشتراك. العودة من صفحة الدفع لا تعني تفعيلًا.'
            : 'Paid access is granted only when the server verifies the subscription. Returning from a payment page is not an activation.'}
        </blockquote>
      </aside>
    </div>
  );
}
