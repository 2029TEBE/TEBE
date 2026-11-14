import { UiText } from '@/components/UiLocale';
import { pageArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { getFrontendLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { when } from '@/lib/fmt';
import { tr, getLang, term } from '@/lib/i18n';

export default async function Decisions() {
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const labelFor = (english: string) => uiLabel(english, locale, pageArabic("decisions", english));
  const t = await tr();
  return (
    <Page title={labelFor("Decisions")} sub={labelFor("The decision log. Every recorded decision, who owned it, and which gate it was taken at — the record auditors ask for first.")}>
      <Loaded load={api.decisions} empty={labelFor("No decisions recorded yet. They are logged as you close gates.")}>
        {(list) => (
          <>
            <section className="design-context" aria-label={labelFor("Decision register summary")}>
              <div className="design-context-head">
                <span className="design-kicker"><UiText text={labelFor("DECISION GOVERNANCE")} /></span>
                <h2><UiText text={labelFor("Recorded decisions overview")} /></h2>
                <p><UiText text={labelFor("Counts reflect only the decisions returned by the authorized API, not necessarily every decision across the organization.")} /></p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small><UiText text={labelFor("Returned decisions")} /></small><strong>{list.length}</strong></div>
                <div className="design-metric"><small><UiText text={labelFor("Linked to a gate")} /></small><strong>{list.filter((d: { atGate?: string | null }) => Boolean(d.atGate)).length}</strong></div>
                <div className="design-metric"><small><UiText text={labelFor("With an owner")} /></small><strong>{list.filter((d: { owner?: string | null }) => Boolean(d.owner)).length}</strong></div>
              </div>
            </section>
            <div className="design-table-scroll" role="region" aria-label={labelFor("Decision register")} tabIndex={0}><table>
              <thead><tr><th scope="col"><UiText text={t('Decision')} /></th><th scope="col"><UiText text={t('Project')} /></th><th scope="col"><UiText text={t('Taken at')} /></th><th scope="col"><UiText text={t('Owner')} /></th><th scope="col"><UiText text={t('Date')} /></th><th scope="col"><UiText text={t('State')} /></th></tr></thead>
            <tbody>{list.map((d: any) => (
              <tr key={d.id}>
                <td><strong><bdi>{d.title}</bdi></strong>{d.detail && <div className="dim"><bdi>{d.detail}</bdi></div>}</td>
                <td className="num"><bdi>{d.projectCode}</bdi></td>
                <td>{d.atGate ? <bdi>{d.atGate}</bdi> : <span className="dim"><UiText text={labelFor("not gate-linked")} /></span>}</td>
                <td>{d.owner ? <bdi>{d.owner}</bdi> : <span className="dim"><UiText text={labelFor("unassigned")} /></span>}</td>
                <td>{when(d.decidedAt, lang)}</td>
                <td><span className={`pill s-${d.status}`}>{term(t, d.status)}</span></td>
              </tr>))}</tbody>
          </table></div>
          </>
        )}
      </Loaded>
    </Page>
  );
}
