/** Never reveal account existence, raw network errors, or upstream response bodies. */
export function recoveryRequestErrorText(status, lang = 'en') {
  const ar = lang === 'ar';
  if (status === 429) return ar
    ? 'محاولات كثيرة لطلب رابط الاستعادة. انتظر قليلًا قبل المحاولة مجددًا.'
    : 'Too many recovery requests. Wait before requesting another link.';
  if (status === 0 || !Number.isInteger(status) || status >= 500) return ar
    ? 'تعذّر تأكيد طلب الاستعادة بسبب عدم توفر الخدمة. تحقق من بريدك قبل المحاولة مجددًا.'
    : 'The recovery request could not be confirmed because the service is unavailable. Check your inbox before retrying.';
  return ar
    ? 'تعذّر تأكيد طلب الاستعادة. تحقق من البيانات أو حاول لاحقًا.'
    : 'The recovery request could not be confirmed. Check the form or try again later.';
}
