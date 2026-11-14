import { UiText } from '@/components/UiLocale';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { ago } from '@/lib/fmt';
import { tr, getLang } from '@/lib/i18n';

export default async function Studio() {
  const lang = await getLang();
  const t = await tr();
  return (
    <Page title="Platform Studio"
          sub="Configure the platform without code — custom fields, gate templates and automations.">
      <Loaded load={api.studio}>
        {(d) => (
          <>
            <section className="design-context" aria-label={lang === 'ar' ? 'ملخص إعدادات المنصة' : 'Platform configuration overview'}>
              <div className="design-context-head">
                <span className="design-kicker"><UiText text={lang === 'ar' ? 'تهيئة مساحة العمل' : 'WORKSPACE CONFIGURATION'} /></span>
                <h2><UiText text={lang === 'ar' ? 'مكونات المنصة الحالية' : 'Configuration catalogue at a glance'} /></h2>
                <p><UiText text={lang === 'ar'
                  ? 'مؤشرات من الإعدادات المسترجعة من المنصة فقط. هذه الصفحة لا تنشئ عمليات تشغيل جديدة.'
                  : 'Counts reflect the currently returned configuration records. No automation is started from this summary.'} /></p>
              </div>
              <div className="design-summary design-summary-four">
                <div className="design-metric"><small><UiText text={t('Automations')} /></small><strong>{d.automations.length}</strong></div>
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'الأتمتة النشطة' : 'Active automations'} /></small><strong>{d.automations.filter((a: any) => a.isActive).length}</strong></div>
                <div className="design-metric"><small><UiText text={t('Custom fields')} /></small><strong>{d.fields.length}</strong></div>
                <div className="design-metric"><small><UiText text={t('Gate templates')} /></small><strong>{d.templates.length}</strong></div>
              </div>
            </section>

            <h2 className="sec" style={{ marginTop: 0 }}><UiText text={t('Automations')} /></h2>
            <div className="design-table-scroll" role="region" aria-label={t('Automations')} tabIndex={0}><table>
              <thead><tr><th><UiText text={t('Automation')} /></th><th><UiText text={t('When')} /></th><th><UiText text={t('Then')} /></th><th><UiText text={t('Runs')} /></th><th><UiText text={t('Last run')} /></th><th><UiText text={t('State')} /></th></tr></thead>
              <tbody>
                {d.automations.map((a: any) => (
                  <tr key={a.id} style={a.isActive ? undefined : { opacity: 0.55 }}>
                    <td><strong>{a.name}</strong></td>
                    <td><code>{a.trigger}</code></td>
                    <td><code>{a.action}</code></td>
                    <td className="num">{a.runCount}</td>
                    <td>{a.lastRunAt ? ago(a.lastRunAt, lang) : <span className="dim"><UiText text={"never"} /></span>}</td>
                    <td><span className={`pill ${a.isActive ? 'on_track' : 's-closed'}`}>
                      <UiText text={a.isActive ? 'active' : 'paused'} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>

            <h2 className="sec"><UiText text={t('Custom fields')} /></h2>
            <div className="design-table-scroll" role="region" aria-label={t('Custom fields')} tabIndex={0}><table>
              <thead><tr><th><UiText text={t('Label')} /></th><th><UiText text={t('Applies to')} /></th><th><UiText text={t('Key')} /></th><th><UiText text={t('Type')} /></th><th><UiText text={t('Options')} /></th><th><UiText text={t('Required')} /></th></tr></thead>
              <tbody>
                {d.fields.map((f: any) => (
                  <tr key={f.id}>
                    <td><strong>{f.label}</strong></td>
                    <td><span className="kind">{f.appliesTo}</span></td>
                    <td><code>{f.fieldKey}</code></td>
                    <td className="dim">{f.fieldType}</td>
                    <td className="dim">{f.options?.join(', ') ?? '—'}</td>
                    <td>{f.isRequired ? <span className="pill critical"><UiText text={"required"} /></span>
                                       : <span className="dim"><UiText text={"optional"} /></span>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>

            <h2 className="sec"><UiText text={t('Gate templates')} /></h2>
            <div className="grid2">
              {d.templates.map((tpl: any) => (
                <div className="panel" key={tpl.id}>
                  <strong>{tpl.name}</strong>
                  <div className="dim" style={{ marginBlock: '4px 10px' }}>{tpl.projectType}</div>
                  <div className="chips">
                    {(tpl.definition?.gates ?? []).map((g: string, i: number) => (
                      <span className="chip" key={g}><UiText text={"SG"} />{i} <UiText text={t(g)} /></span>
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
