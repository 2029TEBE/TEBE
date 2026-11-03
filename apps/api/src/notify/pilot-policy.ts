export function workspaceWelcome(origin: string, lang: 'en' | 'ar') {
  const url = new URL('/', origin);
  if (url.username || url.password || (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('Welcome destination must use HTTPS');
  }
  return lang === 'ar' ? {
    subject: 'مرحباً بك في The EPMO',
    body: `تم تفعيل عضويتك في مساحة العمل. سجّل الدخول لمتابعة خطوات الإعداد.\n${url.origin}/\nتفاصيل المشاريع متاحة داخل المنصة بعد تسجيل الدخول فقط.`,
  } : {
    subject: 'Welcome to The EPMO',
    body: `Your workspace membership is active. Sign in to continue your onboarding checklist.\n${url.origin}/\nProject details are available only inside the authenticated app.`,
  };
}
