import Link from 'next/link';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { ago } from '@/lib/fmt';
import { tr, getLang, getFrontendLocale } from '@/lib/i18n';

export default async function Studio() {
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const t = await tr();
  return (
    <Page title="Platform Studio"
          sub="Configure the platform without code — custom fields, gate templates and automations.">
      <p className="panel" role="note">
        <Link href="/studio/services">{lang === 'ar' ? 'عرض دليل الخدمات المحكوم وطلباتي' : t('View governed services and my requests')}</Link>
        {' — '}{lang === 'ar'
          ? 'تظهر فقط سجلات مساحة العمل المصرح بها. لا يتم نشر خدمات أو تشغيل إجراء من هذا الرابط.'
          : 'Shows authorized workspace records only. No services are published or workflows executed from this link.'}
      </p>
      <Loaded load={api.studio}>
        {(d) => (
          <>
            <section className="design-context" aria-label={lang === 'ar' ? 'ملخص إعدادات المنصة' : 'Platform configuration overview'}>
              <div className="design-context-head">
                <span className="design-kicker">{lang === 'ar' ? 'تهيئة مساحة العمل' : 'WORKSPACE CONFIGURATION'}</span>
                <h2>{lang === 'ar' ? 'مكونات المنصة الحالية' : 'Configuration catalogue at a glance'}</h2>
                <p>{lang === 'ar'
                  ? 'مؤشرات من الإعدادات المسترجعة من المنصة فقط. هذه الصفحة لا تنشئ عمليات تشغيل جديدة.'
                  : 'Counts reflect the currently returned configuration records. No automation is started from this summary.'}</p>
              </div>
              <div className="design-summary design-summary-four">
                <div className="design-metric"><small>{t('Automations')}</small><strong>{d.automations.length}</strong></div>
                <div className="design-metric"><small>{lang === 'ar' ? 'الأتمتة النشطة' : 'Active automations'}</small><strong>{d.automations.filter((a: any) => a.isActive).length}</strong></div>
                <div className="design-metric"><small>{t('Custom fields')}</small><strong>{d.fields.length}</strong></div>
                <div className="design-metric"><small>{t('Gate templates')}</small><strong>{d.templates.length}</strong></div>
              </div>
            </section>

            <h2 className="sec" style={{ marginTop: 0 }}>{t('Automations')}</h2>
            <div className="design-table-scroll" role="region" aria-label={t('Automations')} tabIndex={0}><table>
              <thead><tr><th>{t('Automation')}</th><th>{t('When')}</th><th>{t('Then')}</th><th>{t('Runs')}</th><th>{t('Last run')}</th><th>{t('State')}</th></tr></thead>
              <tbody>
                {d.automations.map((a: any) => (
                  <tr key={a.id} style={a.isActive ? undefined : { opacity: 0.55 }}>
                    <td><strong>{a.name}</strong></td>
                    <td><code>{a.trigger}</code></td>
                    <td><code>{a.action}</code></td>
                    <td className="num">{a.runCount}</td>
                    <td>{a.lastRunAt ? ago(a.lastRunAt, locale) : <span className="dim">never</span>}</td>
                    <td><span className={`pill ${a.isActive ? 'on_track' : 's-closed'}`}>
                      {a.isActive ? 'active' : 'paused'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>

            <h2 className="sec">{t('Custom fields')}</h2>
            <div className="design-table-scroll" role="region" aria-label={t('Custom fields')} tabIndex={0}><table>
              <thead><tr><th>{t('Label')}</th><th>{t('Applies to')}</th><th>{t('Key')}</th><th>{t('Type')}</th><th>{t('Options')}</th><th>{t('Required')}</th></tr></thead>
              <tbody>
                {d.fields.map((f: any) => (
                  <tr key={f.id}>
                    <td><strong>{f.label}</strong></td>
                    <td><span className="kind">{f.appliesTo}</span></td>
                    <td><code>{f.fieldKey}</code></td>
                    <td className="dim">{f.fieldType}</td>
                    <td className="dim">{f.options?.join(', ') ?? '—'}</td>
                    <td>{f.isRequired ? <span className="pill critical">required</span>
                                       : <span className="dim">optional</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>

            <h2 className="sec">{t('Gate templates')}</h2>
            <div className="grid2">
              {d.templates.map((tpl: any) => (
                <div className="panel" key={tpl.id}>
                  <strong>{tpl.name}</strong>
                  <div className="dim" style={{ marginBlock: '4px 10px' }}>{tpl.projectType}</div>
                  <div className="chips">
                    {(tpl.definition?.gates ?? []).map((g: string, i: number) => (
                      <span className="chip" key={g}>SG{i} {t(g)}</span>
                    ))}
                  </div>
                  <div className="dim" style={{ marginBlockStart: 10 }}>
                    {/* Two shapes exist in the data: a flat count, or a map of
                        criteria per named gate. Reading only one printed an
                        empty space where a number should be. */}
                    {typeof tpl.definition?.criteriaPerGate === 'number'
                      ? `${tpl.definition.criteriaPerGate} criteria per gate`
                      : tpl.definition?.criteriaByGate
                        ? `criteria written for ${Object.keys(tpl.definition.criteriaByGate).length}`
                          + ` of ${(tpl.definition.gates ?? []).length} gates`
                        : 'no criteria defined yet'}
                    {' · a new project of this type is created with this shape'}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Loaded>
    </Page>
  );
}
