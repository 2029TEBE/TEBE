import { pageArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { getFrontendLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { NewRecord, Flash } from '@/components/NewRecord';
import { when, num } from '@/lib/fmt';
import { formatNumber } from '@/lib/locale-format.mjs';
import { safeDocumentWebUrl } from '@/lib/document-link.mjs';
import { tr, getLang } from '@/lib/i18n';
import { DocumentUpload } from '@/components/DocumentUpload';
import { localizedStatus } from '@pmo/contracts';

const size = (kb: number | null, locale: string) =>
  kb == null || !Number.isFinite(kb) || kb < 0 ? '—'
    : kb > 1024 ? `${num(kb / 1024, 1, locale)} MB` : `${num(kb, 0, locale)} KB`;

/** Labels only; preserve the original status values for classes and API data. */
const statusLabel = (status: string, lang: string) => localizedStatus('documents', status, lang);

export default async function Documents({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const labelFor = (english: string) => uiLabel(english, locale, pageArabic("documents", english));
  const t = await tr();
  // Outside <Loaded> on purpose: the create form must render even when the
  // list below is empty, which is precisely when someone needs it.
  const o = await api.createOptions().catch(() => ({ projects: [], people: [] }));
  return (
    <Page title={labelFor("Documents")}
          sub={labelFor("Deliverables and gate evidence. A document linked to a gate criterion is what turns a tick into proof.")}>
      <Flash error={error} done={done} lang={lang} />
      <DocumentUpload lang={lang} projects={o.projects ?? []} />
      <NewRecord lang={lang} kind="document" title="Register a document" cta="Register" returnTo="/documents"
        intro="Records a document that lives somewhere else — paste the link. To put a file into your own SharePoint instead, use the upload above."
        fields={[
                { name: 'name', label: 'Document', required: true, placeholder: 'Main contract — signed' },
                { name: 'kind', label: 'Type', required: true, placeholder: 'Contract' },
                { name: 'projectId', label: 'Project', type: 'select',
                  options: o.projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })) },
                { name: 'version', label: 'Version', placeholder: '1.0' },
                { name: 'status', label: 'Status', type: 'select', options: [
                  { value: 'draft', label: 'Draft' }, { value: 'in_review', label: 'In review' },
                  { value: 'approved', label: 'Approved' }, { value: 'superseded', label: 'Superseded' }] },
                { name: 'url', label: 'Link', type: 'url', placeholder: 'https://…' },
                { name: 'ownerId', label: 'Owner', type: 'select',
                  options: o.people.map((p: any) => ({ value: p.id, label: p.name })) },
              ]} />
      <Loaded load={api.documents} empty={labelFor("No documents yet.")}>
        {(list) => (
          <>
            <section className="design-context" aria-label={t('Document overview')}>
              <div className="design-context-head"><span className="design-kicker">{t('Document overview')}</span>
                <h2>{t('Evidence inventory')}</h2>
                <p>{t('Document status and evidence linkage shown from authorized workspace records. File access remains governed by its existing integration.')}</p></div>
              <div className="design-summary">
                <div className="design-metric"><small>{t('Documents')}</small><strong>{formatNumber(list.length, locale)}</strong></div>
                <div className="design-metric"><small>{t('Approved')}</small><strong>{formatNumber(list.filter((d: any) => d.status === 'approved').length, locale)}</strong></div>
                <div className="design-metric"><small>{t('Linked to evidence')}</small><strong>{formatNumber(list.filter((d: any) => Boolean(d.evidenceFor)).length, locale)}</strong></div>
              </div>
            </section>
            <div className="design-table-scroll" role="region" aria-label={labelFor("Document register")} tabIndex={0}><table>
              <thead><tr><th scope="col">{t('Document')}</th><th scope="col">{t('Project')}</th><th scope="col">{t('Type')}</th><th scope="col">{t('Ver')}</th><th scope="col">{t('Evidence for')}</th><th scope="col">{t('Size')}</th><th scope="col">{t('Updated')}</th><th scope="col">{t('Status')}</th></tr></thead>
              <tbody>{list.map((d: any) => (
                <tr key={d.id}>
                  {/* A document held in their Microsoft tenant opens through
                      the API, which asks Graph for a link that works on its
                      own — the stored webUrl only opens for somebody already
                      signed in to that tenant in this browser. */}
                  <td><strong>{d.storageProvider === 'microsoft'
                    ? <a href={`/api/microsoft/documents/${d.id}/open`} target="_blank" rel="noreferrer">
                        <bdi>{d.name}</bdi></a>
                    : safeDocumentWebUrl(d.url)
                      ? <a href={safeDocumentWebUrl(d.url)!} target="_blank" rel="noopener noreferrer"><bdi>{d.name}</bdi></a>
                      : <bdi>{d.name}</bdi>}</strong>
                    {d.storageProvider === 'microsoft' && (
                      <div className="dim">{t('in SharePoint')}</div>
                    )}
                    {d.owner && <div className="dim"><bdi>{d.owner}</bdi></div>}</td>
                  <td className="num"><bdi>{d.projectCode ?? '—'}</bdi></td>
                  <td><span className="kind"><bdi>{d.kind}</bdi></span></td>
                  <td className="num"><bdi>{d.version}</bdi></td>
                  <td>{d.evidenceFor
                    ? <span className="good"><bdi>{d.evidenceFor}</bdi></span>
                    : <span className="dim">—</span>}</td>
                  <td className="num">{size(d.sizeKb, locale)}</td>
                  <td>{d.updatedAt ? <time dateTime={d.updatedAt}>{when(d.updatedAt, locale)}</time> : '—'}</td>
                  <td><span className={`pill ${d.status === 'approved' ? 'on_track'
                    : d.status === 'in_review' ? 'at_risk' : 's-closed'}`}>
                    {statusLabel(d.status, locale)}</span></td>
                </tr>))}</tbody>
            </table></div>
            <details className="explain">
              <summary>{t('How documents connect to governance')}</summary>
              <p>{labelFor("Linking a document to a specific gate criterion helps substantiate approval decisions during reviews and audits. The document register shows the evidence name, version, owner and update date where available, without assuming a fixed number of linked documents.")}</p>
            </details>
          </>
        )}
      </Loaded>
    </Page>
  );
}
