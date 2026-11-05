import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/api';
import { getLang } from '@/lib/i18n';

export const metadata = { title: 'Create an Evaluation workspace · THE EPMO' };

export default async function SignupPage({searchParams}: {
  searchParams: Promise<{error?: string}>,
}) {
  const ar=(await getLang())==='ar';
  const tx=(en:string,arabic:string)=>ar?arabic:en;
  const enabled=process.env.SIGNUP_ENABLED==='true' &&
    process.env.DEPLOYMENT_ENV==='staging';
  const user=await getSession();
  if(user.authenticated) redirect('/billing');
  if(!enabled) return (
    <main className="authwrap"><section className="authpanel">
      <h1>{tx('Registration is not available','التسجيل غير متاح حالياً')}</h1>
      <p>{tx('THE EPMO is preparing a secure seven-day Evaluation.',
        'نعمل على تجهيز تجربة آمنة لمدة سبعة أيام.')}</p>
      <Link href="/login">{tx('Return to sign in','العودة لتسجيل الدخول')}</Link>
    </section></main>
  );
  const {error}=await searchParams;
  return (
    <main className="authwrap">
      <section className="authpanel">
        <h1>{tx('Create your Evaluation workspace','إنشاء مساحة عمل للتجربة')}</h1>
        <p className="sub">{tx('Verify your email first. The seven-day trial starts only when you activate it after signing in. No payment card is required.',
          'تحقق من بريدك الإلكتروني أولاً. تبدأ الأيام السبعة عند تفعيل التجربة بعد تسجيل الدخول. لا تحتاج إلى بطاقة ائتمانية.')}</p>
        <form className="authform" method="post" action="/api/signup/request">
          <label>{tx('Work email','البريد الإلكتروني للعمل')}
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label>{tx('Your name','اسمك')}
            <input name="displayName" autoComplete="name" required minLength={2} maxLength={120}/>
          </label>
          <label>{tx('Workspace name','اسم مساحة العمل')}
            <input name="workspaceName" required minLength={2} maxLength={120}/>
          </label>
          <input type="hidden" name="lang" value={ar?'ar':'en'} />
          {error && <p role="alert" className="formerr">{tx('Registration is unavailable. Please try again later.',
            'التسجيل غير متاح حالياً، يرجى المحاولة لاحقاً.')}</p>}
          <button className="btn wide" type="submit">{tx('Send verification email','إرسال رسالة التحقق')}</button>
        </form>
        <p><Link href="/login">{tx('Already registered? Sign in','لديك حساب بالفعل؟ تسجيل الدخول')}</Link></p>
      </section>
    </main>
  );
}
