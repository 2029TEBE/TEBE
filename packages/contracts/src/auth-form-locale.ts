/** Screen-scoped account form presentation copy; never store tokens or secrets here. */
export const AUTH_FORM_AR: Readonly<Record<'recovery'|'reset'|'invite',Readonly<Record<string,string>>>> = Object.freeze({
  recovery: Object.freeze({
    "Recovery is unavailable right now. Try again later.": "تعذّر إرسال الطلب الآن. حاول لاحقًا.",
    "If an active account exists, a recovery link will be emailed.": "إذا كان الحساب نشطًا فستصلك رسالة تحتوي على رابط الاستعادة.",
    "Account email": "البريد الإلكتروني",
    "Email recovery link": "إرسال رابط الاستعادة",
  }),
  reset: Object.freeze({
    "Passwords do not match.": "كلمتا المرور غير متطابقتين.",
    "This link is invalid or expired. Request another one.": "الرابط غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.",
    "Checking link…": "جارٍ التحقق من الرابط...",
    "Password updated. All previous sessions were revoked.": "تم تغيير كلمة المرور وإلغاء الجلسات القديمة.",
    "Sign in": "تسجيل الدخول",
    "Recovery link is missing or invalid.": "رابط الاستعادة مفقود أو غير صالح.",
    "Request a new link": "اطلب رابطًا جديدًا",
    "New password (at least 12 characters)": "كلمة المرور الجديدة (12 حرفًا على الأقل)",
    "Confirm password": "تأكيد كلمة المرور",
    "Reset password": "تغيير كلمة المرور",
  }),
  invite: Object.freeze({
    "Checking invitation…": "جارٍ التحقق من الدعوة...",
    "Invitation accepted. You can now sign in.": "تم قبول الدعوة. يمكنك تسجيل الدخول الآن.",
    "Sign in": "تسجيل الدخول",
    "The invitation link is missing or invalid.": "رابط الدعوة غير صالح أو مفقود.",
    "If you already have an account, leave the name and password blank. Your existing password will not change.": "إذا كان لديك حساب بالفعل، يمكنك ترك حقلي الاسم وكلمة المرور فارغين. لا تتغير كلمة مرورك الحالية.",
    "Your name (new accounts)": "اسمك (للحساب الجديد)",
    "New password (at least 12 characters)": "كلمة مرور جديدة (12 حرفًا على الأقل)",
    "Accepting…": "جارٍ القبول...",
    "Accept invitation": "قبول الدعوة",
  }),
});
export function authFormLabel(screen: 'recovery'|'reset'|'invite', english: string, lang: 'en'|'ar'): string {
  return lang === 'ar' ? (AUTH_FORM_AR[screen][english] ?? english) : english;
}
