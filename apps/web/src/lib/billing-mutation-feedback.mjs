/** Fail-closed browser feedback for tenant-authenticated billing mutations.
 * No upstream body, session cookie, invoice ID or untrusted URL is reflected.
 * An unknown mutation outcome must not be shown as a completed payment.
 */
export function billingFailurePath(status) {
  if (status === 401) return '/login?error=expired';
  const code = status === 403 ? 'forbidden'
    : status === 409 ? 'conflict'
    : status === 429 ? 'rate_limited'
    : !Number.isInteger(status) || status >= 500 ? 'unavailable'
    : 'failed';
  return '/billing?error=' + code;
}

export function billingFailureText(code, lang = 'en') {
  const messages = {
    forbidden: {
      en: 'This billing change was not authorized. Ask your workspace administrator.',
      ar: 'لم يُسمح بإجراء هذا التغيير في الفوترة. تواصل مع مسؤول مساحة العمل.',
    },
    conflict: {
      en: 'The subscription changed while this request was being processed. Refresh before taking another action.',
      ar: 'تغيّر الاشتراك أثناء معالجة الطلب. حدّث الصفحة قبل اتخاذ إجراء آخر.',
    },
    rate_limited: {
      en: 'Too many billing attempts. Wait before trying again; check the current status first.',
      ar: 'محاولات فوترة كثيرة. انتظر قبل إعادة المحاولة، وتحقق من الحالة الحالية أولًا.',
    },
    unavailable: {
      en: 'The billing operation could not be confirmed. Refresh invoices and subscription status before trying again. Do not assume payment or cancellation succeeded.',
      ar: 'تعذّر تأكيد عملية الفوترة. حدّث الفواتير وحالة الاشتراك قبل المحاولة مجددًا. لا تفترض نجاح الدفع أو الإلغاء.',
    },
    failed: {
      en: 'The billing request was not confirmed. Check your subscription status or contact your administrator.',
      ar: 'لم يتم تأكيد طلب الفوترة. تحقق من حالة الاشتراك أو تواصل مع المسؤول.',
    },
  };
  const key = typeof code === 'string' && Object.hasOwn(messages, code) ? code : 'failed';
  return messages[key][lang === 'ar' ? 'ar' : 'en'];
}
