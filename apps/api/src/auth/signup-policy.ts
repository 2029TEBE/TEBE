import { createHash, randomBytes } from 'node:crypto';

/**
 * Both API and web signup must be disabled in production. CI can enable it
 * only in a disposable test job. Real staging requires a separate explicit
 * feature-flag rollout, HTTPS origin and verified SES delivery.
 */
export function canOfferSignup(env: NodeJS.ProcessEnv = process.env) {
  if (env.SIGNUP_ENABLED !== 'true') return false;
  if (env.DEPLOYMENT_ENV === 'staging' && env.NODE_ENV === 'production') return true;
  return env.NODE_ENV === 'test' && env.CI === 'true' &&
    env.GITHUB_ACTIONS === 'true' &&
    env.PHASE15_ACCEPT_DISPOSABLE_DB === 'YES_RESEED_DISPOSABLE_TEST_DATABASE';
}

const opaque = /^[A-Za-z0-9_-]{43}$/;
export function issueSignupToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashSignupToken(token) };
}
export function hashSignupToken(token: string) {
  if (!opaque.test(token)) throw new Error('Invalid signup token');
  return createHash('sha256').update(token).digest('hex');
}
export function signupConfirmationLink(origin: string, token: string) {
  if (!opaque.test(token)) throw new Error('Invalid signup token');
  const base = new URL(origin);
  if (base.username || base.password || base.search || base.hash ||
    base.pathname !== '/' ||
    (base.protocol !== 'https:' &&
     !(base.protocol === 'http:' && ['localhost','127.0.0.1'].includes(base.hostname))))
    throw new Error('Signup verification requires an approved HTTPS origin');
  base.pathname = '/signup/confirm';
  // Only URL fragments contain the bearer token; HTTP, proxy and Referer
  // request logs never receive it.
  base.hash = 'token=' + token;
  return base.toString();
}
export function signupMessage(link: string, lang: 'ar'|'en') {
  return lang === 'ar' ? {
    subject: 'تأكيد البريد الإلكتروني لإنشاء مساحة THE EPMO',
    body: 'طُلِب إنشاء مساحة عمل جديدة في THE EPMO.\n' +
      'تحقق من بريدك خلال 30 دقيقة عبر الرابط:\n' + link +
      '\nإذا لم تطلب إنشاء حساب، يمكنك تجاهل هذه الرسالة.',
  } : {
    subject: 'Verify your email to create a THE EPMO workspace',
    body: 'A new THE EPMO workspace was requested for this address.\n' +
      'Verify your email within 30 minutes:\n' + link +
      '\nIf you did not request an account, ignore this message.',
  };
}
