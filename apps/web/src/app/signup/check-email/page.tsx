import Link from 'next/link';
import { getLang } from '@/lib/i18n';
export const metadata = {title:'Check your email · THE EPMO'};
export default async function CheckEmailPage() {
  const ar=(await getLang())==='ar';
  return <main className="authwrap"><section className="authpanel">
    <h1>{ar?'تحقق من بريدك الإلكتروني':'Check your email'}</h1>
    <p>{ar?'إذا كان البريد مؤهلاً، ستصلك رسالة للتحقق خلال دقائق. ينتهي الرابط بعد 30 دقيقة.'
      :'If the address is eligible, you will receive a verification link. It expires after 30 minutes.'}</p>
    <p>{ar?'لن يتم إنشاء حساب أو بدء تجربة حتى تتحقق من البريد وتسجيل الدخول وتفعيل التجربة.'
      :'No account or trial begins until you verify your email, sign in, and choose to activate Evaluation.'}</p>
    <Link href="/login">{ar?'تسجيل الدخول':'Sign in'}</Link>
  </section></main>;
}
