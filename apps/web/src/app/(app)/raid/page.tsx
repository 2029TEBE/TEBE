import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { NewRecord, Flash } from '@/components/NewRecord';
import { getLang, getFrontendLocale, tr } from '@/lib/i18n';
import { num } from '@/lib/fmt';
import { raidRiskScore, isCriticalRaidRisk } from '@/lib/raid-risk-score.mjs';

export default async function RaidPage({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;
  const t = await tr();
  const lang = await getLang();
  const locale = await getFrontendLocale();
  return (
    <Page title={t('RAID & Governance')}
          sub={t('Risks, assumptions, issues, dependencies, changes and decisions. An open item pointed at a gate holds that gate shut.')}>
      <Flash error={error} done={done} lang={lang} />
      <Loaded load={async () => ({ items: await api.raid(), o: await api.createOptions() })}>
        {({ items, o }) => (
          <>
            <NewRecord lang={lang} kind="raid" title="New register item" cta="Add to register" returnTo="/raid"
              intro="Point an item at a project's open gate and it will hold that gate shut until the item is closed."
              fields={[
                { name: 'projectId', label: 'Project', type: 'select', required: true,
                  options: o.projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })) },
                { name: 'kind', label: 'Type', type: 'select', required: true, options: [
                  { value: 'risk', label: 'Risk' }, { value: 'issue', label: 'Issue' },
                  { value: 'dependency', label: 'Dependency' }, { value: 'assumption', label: 'Assumption' },
                  { value: 'change', label: 'Change' }, { value: 'decision', label: 'Decision' }] },
                { name: 'title', label: 'Title', required: true,
                  placeholder: 'Contractor has not submitted signed bonds' },
                { name: 'severity', label: 'Impact (1–5)', type: 'number', min: 1, max: 5, step: 1, hint: '5 = severe' },
                { name: 'likelihood', label: 'Likelihood (1–5)', type: 'number', min: 1, max: 5, step: 1, hint: '5 = almost certain' },
                { name: 'ownerId', label: 'Owner', type: 'select',
                  options: o.people.map((p: any) => ({ value: p.id, label: p.name })) },
                { name: 'dueDate', label: 'Due date', type: 'date' },
                { name: 'detail', label: 'Detail', type: 'textarea' },
                { name: 'blocksActiveGate', label: 'Block this project’s open gate until closed',
                  type: 'checkbox' },
              ]} />

            {items.length === 0 ? (
              <div className="empty">
                <strong>{t('The register is empty')}</strong>
                <p>{t('Add risks, issues and dependencies above. Pointing one at a gate is what turns a register entry into a control.')}</p>
              </div>
            ) : (
              <div className="design-table-scroll" role="region" aria-label={t('Risk and issue register')} tabIndex={0}><table>
                <thead>
                  <tr><th scope="col">{t('Project')}</th><th scope="col">{t('Type')}</th><th scope="col">{t('Item')}</th><th scope="col">{t('Risk')}</th>
                      <th scope="col">{t('Owner')}</th><th scope="col">{t('Blocks')}</th><th scope="col">{t('Status')}</th></tr>
                </thead>
                <tbody>
                  {items.map((r: any) => (
                    <tr key={r.id} style={r.status === 'closed' ? { opacity: 0.55 } : undefined}>
                      <td className="num"><bdi>{r.projectCode}</bdi></td>
                      <td><span className={`kind k-${r.kind}`}><bdi>{t(r.kind)}</bdi></span></td>
                      <td><strong><bdi>{r.title}</bdi></strong>{r.detail && <div className="dim"><bdi>{r.detail}</bdi></div>}</td>
                      <td className="num">{raidRiskScore(r.severity, r.likelihood) != null
                        ? <span className={isCriticalRaidRisk(raidRiskScore(r.severity, r.likelihood)) ? 'crit' : 'warnt'}>
                            {num(raidRiskScore(r.severity, r.likelihood), 0, locale)} {t('of 25')}</span>
                        : <span className="dim">—</span>}</td>
                      <td>{r.owner ? <bdi>{r.owner}</bdi> : <span className="dim">{t("unassigned")}</span>}</td>
                      <td>{r.blocksGate
                        ? <span className="crit"><bdi>{r.blocksGate}</bdi></span>
                        : <span className="dim">—</span>}</td>
                      <td><span className={`pill s-${r.status}`}>{t(r.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </>
        )}
      </Loaded>
    </Page>
  );
}
