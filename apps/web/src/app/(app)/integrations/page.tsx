import { api, getSession } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { ago, num } from '@/lib/fmt';
import { tr, getLang } from '@/lib/i18n';
import { MicrosoftPanel } from '@/components/MicrosoftPanel';
import { can, type Capability } from '@pmo/contracts';

export default async function Integrations({ searchParams }:
  { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const { connected, error } = await searchParams;
  const lang = await getLang();
  const t = await tr();
  const session = await getSession();
  const caps = ((session.authenticated ? session.capabilities : ['read']) ?? ['read']) as Capability[];
  // Fetched here rather than in the panel so the page renders complete. A
  // failure is not fatal: the panel asks again from the browser.
  const ms = await api.microsoft().catch(() => null);

  return (
    <Page title="Integrations" sub="Connections to the systems the delivery world actually runs on.">
      <MicrosoftPanel lang={lang} mayManage={can(caps, 'pmoa_admin')}
                      flash={{ connected, error }} initial={ms} />

      <h2 className="sec">{t('Everything else')}</h2>
      <Loaded load={api.integrations} empty={lang === 'ar' ? 'لم تُهيأ تكاملات أخرى بعد.' : 'No other integrations configured.'}>
        {(list) => (
          <>
            <section className="design-context" aria-label={lang === 'ar' ? 'ملخص التكاملات الأخرى' : 'Other integrations snapshot'}>
              <div className="design-context-head">
                <span className="design-kicker">{lang === 'ar' ? 'ترابط الأنظمة' : 'CONNECTED SYSTEMS'}</span>
                <h2>{lang === 'ar' ? 'حالة التكاملات الأخرى' : 'Other integration status'}</h2>
                <p>{lang === 'ar'
                  ? 'هذه المؤشرات محسوبة من سجلات التكاملات الأخرى المعادة فقط، ولا تشمل اتصال Microsoft المعروض أعلاه.'
                  : 'These metrics count only the other integrations returned by this API response; Microsoft is displayed separately above.'}</p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small>{lang === 'ar' ? 'التكاملات المعادة' : 'Returned integrations'}</small><strong>{list.length}</strong></div>
                <div className="design-metric"><small>{lang === 'ar' ? 'متصلة' : 'Connected'}</small><strong>{list.filter((item: { status: string }) => item.status === 'connected').length}</strong></div>
                <div className="design-metric"><small>{lang === 'ar' ? 'تحتاج إلى معالجة' : 'Connection errors'}</small><strong>{list.filter((item: { status: string }) => item.status === 'error').length}</strong></div>
              </div>
            </section>
            <div className="grid2">
              {list.map((i: any) => (
                <div className={`panel integ s-${i.status}`} key={i.id}>
                  <header>
                    <strong>{i.name}</strong>
                    <span className={`pill ${i.status === 'connected' ? 'on_track'
                      : i.status === 'error' ? 'critical' : 's-closed'}`}>{
                        lang === 'ar' && i.status === 'connected' ? 'متصل'
                        : lang === 'ar' && i.status === 'error' ? 'خطأ'
                        : i.status
                      }</span>
                  </header>
                  <dl>
                    <div><dt>{t('Provider')}</dt><dd><code>{i.provider}</code></dd></div>
                    <div><dt>{t('Direction')}</dt><dd>{i.direction}</dd></div>
                    <div><dt>{t('Records synced')}</dt><dd className="num">{num(i.recordsSynced)}</dd></div>
                    <div><dt>{t('Last sync')}</dt><dd>{i.lastSyncAt ? ago(i.lastSyncAt, lang) : (lang === 'ar' ? 'لم تتم مزامنة' : 'Never synced')}</dd></div>
                  </dl>
                  {i.lastError && <p className="err" style={{ marginBlockStart: 12 }}>{i.lastError}</p>}
                </div>
              ))}
            </div>
            <details className="explain">
              <summary>{t('Why these particular integrations')}</summary>
              <p>{t('Capital programmes in the region already run on Primavera P6 for schedules and SharePoint for documents, and finance teams want the numbers in Power BI. An integration that pulls a P6 schedule in is worth more than any feature we could build to replace it — the goal is to govern the delivery data, not to make people re-enter it.')}</p>
            </details>
          </>
        )}
      </Loaded>
    </Page>
  );
}
