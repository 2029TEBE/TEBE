import Link from 'next/link';
import {getLang} from '@/lib/i18n';
import {ConfirmForm} from './ConfirmForm';
export const metadata={title:'Confirm your email · THE EPMO'};
export default async function ConfirmSignupPage(){
  const ar=(await getLang())==='ar';
  const enabled=process.env.SIGNUP_ENABLED==='true' &&
    process.env.DEPLOYMENT_ENV==='staging';
  return <main className="authwrap"><section className="authpanel">
    <h1>{ar?'تأكيد البريد الإلكتروني':'Verify your email'}</h1>
    {enabled?<ConfirmForm ar={ar}/>:
      <p>{ar?'التسجيل غير متاح حالياً.':'Registration is not available.'}</p>}
    <Link href="/login">{ar?'العودة لتسجيل الدخول':'Back to sign in'}</Link>
  </section></main>;
}
