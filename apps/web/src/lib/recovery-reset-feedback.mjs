/**
 * Browser-side password-reset guidance. Only HTTP status codes enter this helper:
 * never display upstream bodies, reset bearers, or browser network exception text.
 */
export function recoveryResetErrorText(status, lang = 'en') {
  const ar = lang === 'ar';
  if (status === 'unconfirmed') return ar
    ? 'لم نتمكن من تأكيد تغيير كلمة المرور. جرّب تسجيل الدخول أولًا؛ وإذا لم تنجح فاطلب رابط استعادة جديدًا.'
    : 'The password change could not be confirmed. Try signing in first; if that fails, request a new recovery link.';
  if (status === 429) return ar
    ? 'محاولات كثيرة. انتظر قليلًا قبل إعادة المحاولة. احتفظ برابط الاستعادة.'
    : 'Too many attempts. Wait before retrying. Keep your recovery link.';
  if (status === 0 || status >= 500) return ar
    ? 'خدمة استعادة كلمة المرور غير متاحة مؤقتًا. لم يتم تأكيد التغيير؛ حاول لاحقًا دون طلب رابط جديد الآن.'
    : 'Password recovery is temporarily unavailable. The change was not confirmed; retry later without requesting a new link yet.';
  return ar
    ? 'تعذّر تأكيد تغيير كلمة المرور. قد يكون الرابط غير صالح أو منتهي الصلاحية؛ تحقق منه أو اطلب رابطًا جديدًا.'
    : 'The password change could not be confirmed. The link may be invalid or expired; check it or request a new link.';
}

/**
 * Synchronous single-flight guard for a credential-bearing reset mutation.
 * A successful reset permanently locks the mounted form against replay.
 * A failed or interrupted attempt can be retried explicitly by the user.
 */
export function createRecoverySubmissionGate() {
  let state = 'idle';
  return {
    begin() {
      if (state !== 'idle') return false;
      state = 'pending';
      return true;
    },
    settle(succeeded) {
      if (state !== 'pending') return;
      state = succeeded ? 'complete' : 'idle';
    },
  };
}
