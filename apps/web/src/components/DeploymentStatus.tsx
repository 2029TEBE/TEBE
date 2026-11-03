import React from 'react';

/** Read-only display of server-attested deployment information. Never accept user-supplied compliance claims. */
export type DeploymentView = {
  profile: 'shared_saudi_saas' | 'dedicated_saudi_enterprise' | 'dedicated_saudi_government';
  state: 'requested' | 'approved' | 'provisioning' | 'active';
  region: string | null;
  verified: boolean;
};
const copy = {
  en: {
    title: 'Deployment status', unknown: 'Not independently verified',
    profile: { shared_saudi_saas: 'Shared Saudi SaaS', dedicated_saudi_enterprise: 'Dedicated Saudi enterprise', dedicated_saudi_government: 'Dedicated Saudi government' },
    state: { requested: 'Requested', approved: 'Approved', provisioning: 'Provisioning', active: 'Active' },
    region: 'Hosting region', unconfirmed: 'Not confirmed',
    warning: 'Deployment status is informational and does not certify regulatory compliance.'
  },
  ar: {
    title: 'حالة الاستضافة', unknown: 'لم يتم التحقق بشكل مستقل',
    profile: { shared_saudi_saas: 'خدمة سحابية مشتركة في السعودية', dedicated_saudi_enterprise: 'استضافة سعودية مخصصة للمنشآت', dedicated_saudi_government: 'استضافة سعودية مخصصة للجهات الحكومية' },
    state: { requested: 'تم الطلب', approved: 'تمت الموافقة', provisioning: 'جارٍ التجهيز', active: 'نشط' },
    region: 'منطقة الاستضافة', unconfirmed: 'غير مؤكدة',
    warning: 'حالة الاستضافة للعلم فقط ولا تمثل شهادة امتثال للأنظمة.'
  }
} as const;

export function DeploymentStatus({ deployment, locale = 'en' }: { deployment: DeploymentView | null; locale?: 'ar' | 'en' }) {
  const t = copy[locale];
  const trusted = deployment?.verified === true;
  return <section aria-label={t.title} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <h2>{t.title}</h2>
    {!trusted ? <p role="status">{t.unknown}</p> : <>
      <p>{t.profile[deployment.profile]}</p>
      <p role="status">{t.state[deployment.state]}</p>
      <p>{t.region}: {deployment.region || t.unconfirmed}</p>
    </>}
    <small>{t.warning}</small>
  </section>;
}
