import { tr } from '@/lib/i18n';
export default async function NotFound() {
  const t = await tr();
  return (
    <div className="authwrap" style={{ gridTemplateColumns: '1fr' }}>
      <div className="authpanel" style={{ maxWidth: 'none', justifyItems: 'center', textAlign: 'center' }}>
        <span className="tag">404</span>
        <h1 style={{ marginBlock: '16px 8px' }}>{t('That page does not exist')}</h1>
        <p className="dim" style={{ maxWidth: '46ch' }}>
          {t('The link may be out of date, or the module may not be part of your workspace.')}
        </p>
        <a className="btn" href="/" style={{ marginBlockStart: 18 }}>{t('Back to overview')}</a>
      </div>
    </div>
  );
}
