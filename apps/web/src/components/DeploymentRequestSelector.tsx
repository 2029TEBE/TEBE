'use client';

import { useId, useState } from 'react';

export type DeploymentPreference = 'shared_saudi_saas' | 'dedicated_saudi_enterprise' | 'dedicated_saudi_government';
type Locale = 'ar' | 'en';
type Props = {
  locale?: Locale;
  /** Only pass a handler backed by an authenticated, tenant-authorized request API. */
  onRequest?: (preference: DeploymentPreference) => Promise<void>;
  disabled?: boolean;
};

const messages = {
  en: {
    heading: 'Choose a deployment preference',
    description: 'This is a request, not an approval or an active deployment. Dedicated hosting requires review.',
    options: {
      shared_saudi_saas: ['Shared Saudi SaaS', 'Multi-tenant service with tenant isolation.'],
      dedicated_saudi_enterprise: ['Dedicated Saudi enterprise', 'Request a dedicated environment for your organization.'],
      dedicated_saudi_government: ['Dedicated Saudi government', 'Request review for a government deployment. No compliance status is implied.'],
    },
    submit: 'Request deployment review',
    unavailable: 'Requests are not available until a secure service is connected.',
    pending: 'Submitting request…',
    success: 'Request submitted for review. Approval and provisioning are separate steps.',
    failure: 'Request could not be submitted. Please retry.',
    disclaimer: 'Selecting an option does not establish eligibility, residency, security accreditation, or regulatory compliance.',
  },
  ar: {
    heading: 'اختر تفضيل الاستضافة',
    description: 'هذا طلب وليس موافقة أو تفعيلًا للاستضافة. تتطلب الاستضافة المخصصة مراجعة.',
    options: {
      shared_saudi_saas: ['خدمة سحابية سعودية مشتركة', 'خدمة متعددة المستأجرين مع عزل بيانات كل جهة.'],
      dedicated_saudi_enterprise: ['استضافة سعودية مخصصة للمنشآت', 'طلب بيئة مستقلة لمنشأتك.'],
      dedicated_saudi_government: ['استضافة سعودية مخصصة للجهات الحكومية', 'طلب مراجعة لاستضافة حكومية دون الإقرار بأي حالة امتثال.'],
    },
    submit: 'إرسال طلب مراجعة الاستضافة',
    unavailable: 'الطلبات غير متاحة حتى ربط خدمة آمنة.',
    pending: 'جارٍ إرسال الطلب…',
    success: 'تم إرسال الطلب للمراجعة. الموافقة والتجهيز مرحلتان منفصلتان.',
    failure: 'تعذر إرسال الطلب. يرجى المحاولة مجددًا.',
    disclaimer: 'اختيار أحد الخيارات لا يثبت الأهلية أو موقع استضافة البيانات أو الاعتماد الأمني أو الامتثال التنظيمي.',
  },
} as const;

const options: DeploymentPreference[] = [
  'shared_saudi_saas',
  'dedicated_saudi_enterprise',
  'dedicated_saudi_government',
];

/** UI only. Never persist a preference as an approved or active deployment status. */
export function DeploymentRequestSelector({ locale = 'en', onRequest, disabled = false }: Props) {
  const t = messages[locale];
  const groupId = useId();
  const [preference, setPreference] = useState<DeploymentPreference>('shared_saudi_saas');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<'success' | 'failure' | null>(null);
  const unavailable = !onRequest || disabled;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onRequest || pending || disabled) return;
    setPending(true);
    setResult(null);
    try {
      await onRequest(preference);
      setResult('success');
    } catch {
      setResult('failure');
    } finally {
      setPending(false);
    }
  }

  return (
    <section dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-labelledby={groupId + '-title'}>
      <h2 id={groupId + '-title'}>{t.heading}</h2>
      <p id={groupId + '-description'}>{t.description}</p>
      <form onSubmit={submit}>
        <fieldset disabled={disabled || pending} aria-describedby={groupId + '-description'}>
          <legend>{t.heading}</legend>
          {options.map((option) => (
            <label key={option} style={{ display: 'block', paddingBlock: '0.75rem' }}>
              <input
                type="radio"
                name={groupId}
                value={option}
                checked={preference === option}
                onChange={() => { setPreference(option); setResult(null); }}
              />
              <strong> {t.options[option][0]}</strong>
              <span style={{ display: 'block' }}>{t.options[option][1]}</span>
            </label>
          ))}
        </fieldset>
        <button type="submit" disabled={unavailable || pending} aria-busy={pending}>
          {pending ? t.pending : t.submit}
        </button>
        {unavailable && <p role="status">{t.unavailable}</p>}
        {result && <p role="status" aria-live="polite">{result === 'success' ? t.success : t.failure}</p>}
      </form>
      <small>{t.disclaimer}</small>
    </section>
  );
}
