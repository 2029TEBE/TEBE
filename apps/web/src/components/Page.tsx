import { UiText } from '@/components/UiLocale';
import { tr, getLang } from '@/lib/i18n';
/**
 * Every screen's heading goes through here, so translating the shell
 * translates 26 titles and subtitles without touching 26 files. Pages keep
 * passing English — that is the key the dictionary is looked up by.
 */
export async function Page({ title, sub, children }:
  { title: string; sub?: string; children?: React.ReactNode }) {
  const t = await tr();
  return (
    <>
      <h1><UiText text={t(title)} /></h1>
      {sub && <p className="sub"><UiText text={t(sub)} /></p>}
      {children}
    </>
  );
}

export async function Loaded<T>({ load, children, empty }:
  { load: () => Promise<T>; children: (d: T) => React.ReactNode; empty?: string }) {
  const t = await tr();
  const lang = await getLang();
  let data: T;
  try { data = await load(); }
  catch (e) {
    const err = e as { status?: number; detail?: string; message: string; isNotLicensed?: boolean };
    // A module this workspace has not licensed is a normal state, not a fault.
    if (err.isNotLicensed || (err.status === 403 && /not enabled|subscription expired/i.test(err.detail ?? ''))) {
      return (
        <div className="panel locked">
          <span className="tag"><UiText text={t('Not included in your plan')} /></span>
          <h2 style={{ fontSize: 'var(--fs-lg)', margin: '14px 0 8px' }}><UiText text={t('This module is not enabled')} /></h2>
          <p className="dim" style={{ maxWidth: '60ch' }}>{err.detail}</p>
          <p className="dim" style={{ maxWidth: '60ch' }}>
            <UiText text={t('The EPMO is licensed per module. An administrator can turn this on from')} />{' '}
            <a href="/platform"><UiText text={t('Platform & Modules')} /></a>.
          </p>
        </div>
      );
    }
    if (err.status === 403) {
      return (
        <div className="panel locked">
          <span className="tag"><UiText text={t('Not permitted')} /></span>
          <h2 style={{ fontSize: 'var(--fs-lg)', margin: '14px 0 8px' }}><UiText text={t('Your role cannot open this')} /></h2>
          <p className="dim">{err.detail}</p>
        </div>
      );
    }
    return (
      <div className="panel err" role="alert">
        <strong><UiText text={lang === 'ar' ? 'تعذر تحميل هذه البيانات' : 'Unable to load this data'} /></strong>
        <p><UiText text={lang === 'ar'
          ? 'حدث خطأ أثناء تحميل المحتوى. حدّث الصفحة، وإذا استمرت المشكلة فتواصل مع مسؤول مساحة العمل.'
          : 'There was a problem loading this content. Refresh the page, or contact your workspace administrator if the issue continues.'} /></p>
      </div>
    );
  }
  if (Array.isArray(data) && data.length === 0) {
    return <div className="panel"><UiText text={t(empty ?? 'Nothing here yet.')} /></div>;
  }
  return <>{children(data)}</>;
}
