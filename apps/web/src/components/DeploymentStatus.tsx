import React from 'react';

/**
 * Presentation only: a verified flag is NOT an attestation mechanism.
 * Callers must obtain deployment data from an authenticated, tenant-scoped server API.
 * Never populate this view from URL parameters, local storage or user-editable forms.
 */
export type DeploymentView = {
  profile: 'shared_saudi_saas' | 'dedicated_saudi_enterprise' | 'dedicated_saudi_government';
  state: 'requested' | 'approved' | 'provisioning' | 'active';
  region: string | null;
  verified: boolean;
};
type Locale = 'ar' | 'en';
const copy = {
  en: {
    title: 'Deployment status', unknown: 'Deployment information is not verified',
    loading: 'Loading deployment information', error: 'Deployment information is unavailable',
    profile: { shared_saudi_saas: 'Shared Saudi SaaS', dedicated_saudi_enterprise: 'Dedicated Saudi enterprise', dedicated_saudi_government: 'Dedicated Saudi government' },
    state: { requested: 'Requested', approved: 'Approved', provisioning: 'Provisioning', active: 'Active' },
    region: 'Hosting region', unconfirmed: 'Not confirmed',
    warning: 'Deployment status is informational; it does not certify regulatory compliance.'
  },
  ar: {
    title: 'حالة الاستضافة', unknown: 'لم يتم التحقق من معلومات الاستضافة',
    loading: 'جارٍ تحميل معلومات الاستضافة', error: 'معلومات الاستضافة غير متاحة',
    profile: { shared_saudi_saas: 'خدمة سحابية مشتركة في السعودية', dedicated_saudi_enterprise: 'استضافة سعودية مخصصة للمنشآت', dedicated_saudi_government: 'استضافة سعودية مخصصة للجهات الحكومية' },
    state: { requested: 'تم الطلب', approved: 'تمت الموافقة', provisioning: 'جارٍ التجهيز', active: 'نشط' },
    region: 'منطقة الاستضافة', unconfirmed: 'غير مؤكدة',
    warning: 'حالة الاستضافة للعلم فقط ولا تمثل شهادة امتثال للأنظمة.'
  }
} as const;

const profiles = new Set(['shared_saudi_saas', 'dedicated_saudi_enterprise', 'dedicated_saudi_government']);
const states = new Set(['requested', 'approved', 'provisioning', 'active']);

/** Defensive rendering guard, not a substitute for server-side authorization or attestation. */
export function isDisplayableDeployment(value: unknown): value is DeploymentView {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return data.verified === true &&
    typeof data.profile === 'string' && profiles.has(data.profile) &&
    typeof data.state === 'string' && states.has(data.state) &&
    (data.region === null || (typeof data.region === 'string' && data.region.length <= 100));
}

export function DeploymentStatus({
  deployment, locale = 'en', pending = false, failed = false
}: {
  deployment: DeploymentView | null;
  locale?: Locale;
  pending?: boolean;
  failed?: boolean;
}) {
  const t = copy[locale];
  const trusted = !pending && !failed && isDisplayableDeployment(deployment);
  const message = pending ? t.loading : failed ? t.error : t.unknown;
  return <section aria-label={t.title} dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-busy={pending}>
    <h2>{t.title}</h2>
    {!trusted ? <p role="status">{message}</p> : <>
      <p>{t.profile[deployment.profile]}</p>
      <p role="status">{t.state[deployment.state]}</p>
      <p>{t.region}: {deployment.region || t.unconfirmed}</p>
    </>}
    <small>{t.warning}</small>
  </section>;
}
