import { UiText } from '@/components/UiLocale';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { tr, getLang } from '@/lib/i18n';
import { WORKBOOK } from '@pmo/contracts';
import { ImportPanel, Report, type ImportReport } from '@/components/ImportPanel';

function decode(v?: string): ImportReport | null {
  if (!v) return null;
  try { return JSON.parse(Buffer.from(v, 'base64url').toString('utf8')); }
  catch { return null; }
}

export default async function DataPage({ searchParams }:
  { searchParams: Promise<{ error?: string; report?: string }> }) {
  const { error, report } = await searchParams;
  const lang = await getLang();
  const t = await tr();
  const r = decode(report);

  return (
    <Page title="Import & Export"
          sub="Move a whole project in or out as a single spreadsheet. The blank template, an export and an upload are all the same workbook, so anything you download can be edited and sent straight back.">
      {error && <p className="err" role="alert" style={{ marginBlockEnd: 16 }}><UiText text={t(error)} /></p>}

      {/* Only reached without JavaScript, where the upload redirects here with
          the report in the query string. With it, ImportPanel draws its own. */}
      {r && <Report t={t} r={r} />}

      <div className="xlgrid">
        <section className="panel">
          <h2><UiText text={t('Blank template')} /></h2>
          <p className="dim"><UiText text={t('Every section of a project in one file, with the seven stage gates and their standard checklist already written — so a project loaded from it can be governed the moment it lands.')} /></p>
          <div className="act btnrow">
            <a className="btn" href="/api/excel/download"><UiText text={t('Download')} /></a>
            <a className="btn ghost" href="/api/excel/download?lang=ar"><UiText text={t('Arabic')} /></a>
          </div>
        </section>

        <section className="panel">
          <h2><UiText text={t('Export a project')} /></h2>
          <p className="dim"><UiText text={t('Everything held about one project, in that same workbook. Edit it and send it back as a new project, or keep it as a record of how things stood today.')} /></p>
          <Loaded load={api.projects} empty="No projects to export yet.">
            {(d: any) => (
              <form method="get" action="/api/excel/download" className="act inline">
                <label>
                  <UiText text={t('Project')} />
                  <select name="code" required defaultValue="">
                    <option value="" disabled><UiText text={t('Choose…')} /></option>
                    {d.items.map((p: any) => (
                      <option key={p.id} value={p.code}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </label>
                <input type="hidden" name="lang" value={lang} />
                <button className="btn" type="submit"><UiText text={t('Download')} /></button>
              </form>
            )}
          </Loaded>
        </section>

        <ImportPanel lang={lang} />
      </div>

      <h2 className="sec"><UiText text={t('What is in the workbook')} /></h2>
      <div className="tablewrap design-table-scroll" role="region" aria-label={lang === 'ar' ? 'محتويات ملف العمل' : 'Workbook contents'} tabIndex={0}>
        <table>
          <thead><tr><th><UiText text={t('Sheet')} /></th><th><UiText text={t('What it holds')} /></th><th><UiText text={t('Required columns')} /></th></tr></thead>
          <tbody>
            {WORKBOOK.map((s) => (
              <tr key={s.key}>
                <td><strong>{lang === 'ar' ? s.nameAr : s.name}</strong></td>
                <td className="dim">{s.purpose}</td>
                <td className="dim">
                  {s.columns.filter((c) => c.required)
                    .map((c) => (lang === 'ar' ? c.headerAr : c.header)).join(' · ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="explain">
        <summary><UiText text={t('Why one workbook instead of three')} /></summary>
        <p><UiText text={t('A separate template, export format and import format drift apart, and a customer discovers it by having a workbook they downloaded rejected when they upload it. Here all three are generated from one definition, so a column added to the platform appears in the blank template, in an export and in the importer at the same moment.')} /></p>
      </details>
    </Page>
  );
}
