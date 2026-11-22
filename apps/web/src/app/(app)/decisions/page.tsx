import { pageArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { getFrontendLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { when } from '@/lib/fmt';
import { tr, term } from '@/lib/i18n';

export default async function Decisions() {
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
                <span className="design-kicker">{labelFor("DECISION GOVERNANCE")}</span>
                <h2>{labelFor("Recorded decisions overview")}</h2>
                <p>{labelFor("Counts reflect only the decisions returned by the authorized API, not necessarily every decision across the organization.")}</p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small>{labelFor("Returned decisions")}</small><strong>{list.length}</strong></div>
                <div className="design-metric"><small>{labelFor("Linked to a gate")}</small><strong>{list.filter((d: { atGate?: string | null }) => Boolean(d.atGate)).length}</strong></div>
                <div className="design-metric"><small>{labelFor("With an owner")}</small><strong>{list.filter((d: { owner?: string | null }) => Boolean(d.owner)).length}</strong></div>
              </div>
            </section>
            <div className="design-table-scroll" role="region" aria-label={labelFor("Decision register")} tabIndex={0}><table>
              <thead><tr><th scope="col">{t('Decision')}</th><th scope="col">{t('Project')}</th><th scope="col">{t('Taken at')}</th><th scope="col">{t('Owner')}</th><th scope="col">{t('Date')}</th><th scope="col">{t('State')}</th></tr></thead>
            <tbody>{list.map((d: any) => (
              <tr key={d.id}>
                <td><strong><bdi>{d.title}</bdi></strong>{d.detail && <div className="dim"><bdi>{d.detail}</bdi></div>}</td>
                <td className="num"><bdi>{d.projectCode}</bdi></td>
                <td>{d.atGate ? <bdi>{d.atGate}</bdi> : <span className="dim">{labelFor("not gate-linked")}</span>}</td>
                <td>{d.owner ? <bdi>{d.owner}</bdi> : <span className="dim">{labelFor("unassigned")}</span>}</td>
                <td>{when(d.decidedAt, locale)}</td>
                <td><span className={`pill s-${d.status}`}>{term(t, d.status)}</span></td>
              </tr>))}</tbody>
          </table></div>
          </>
        )}
      </Loaded>
    </Page>
  );
}
