import { api, getSession } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { when } from '@/lib/fmt';
import { tr, getLang, getFrontendLocale } from '@/lib/i18n';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { settingsArabic } from '@pmo/contracts';
import { Flash } from '@/components/NewRecord';
import { ROLE_LABELS, ASSIGNABLE_ROLES, can, type Capability } from '@pmo/contracts';

const CAP_MEANING: Record<string, string> = {
  read: 'See the workspace and anything not otherwise restricted',
  pmoa_view_portfolio: 'View portfolios, programmes and analytics',
  pmoa_view_financials: 'View budgets, spend and benefits',
  pmoa_manage_projects: 'Create and change projects and programmes',
  pmoa_manage_work: 'Manage tasks and the schedule',
  pmoa_post_updates: 'Post updates and escalations to the shared activity feed',
  pmoa_manage_raid: 'Manage the register and stage gates',
  pmoa_approve: 'Sign gate approvals',
  pmoa_manage_finance: 'Record budgets, costs and benefits',
  pmoa_manage_people: 'Add people and change what they may do',
  pmoa_admin: 'Configure the workspace',
  pmoa_platform: 'Operate the platform itself — module licensing',
};

export default async function Settings({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const labelFor = (english: string) => uiLabel(english, locale, settingsArabic(english));
  const t = await tr();
  // Adding people is its own permission. Offering the form to everyone meant a
  // Team Member could fill in four fields and only then be told no.
  const session = await getSession();
  const caps = ((session.authenticated ? session.capabilities : ['read']) ?? ['read']) as Capability[];
  const mayAddPeople = can(caps, 'pmoa_manage_people');
  const mayEditProfile = can(caps, 'pmoa_admin');
  return (
    <Page title="Workspace Settings" sub="Who is in this workspace, what they can do, and how it is configured.">
      <Flash error={error} done={done} lang={lang} />
      <Loaded load={api.workspaceProfile}>
        {(profile) => <section className="panel" style={{ marginBottom: 18 }}>
          <h2 className="sec" style={{ marginTop: 0 }}>{labelFor("Organization profile")}</h2>
          {mayEditProfile ? <form action="/api/onboarding" method="post" style={{ display: 'grid', gap: 10, maxWidth: 500 }}>
            <input type="hidden" name="action" value="profile" />
            <label>{labelFor("Display name")}<input name="displayName" defaultValue={profile.displayName} required minLength={2} maxLength={120} /></label>
            <label>{labelFor("Arabic name")}<input name="nameAr" defaultValue={profile.nameAr ?? ''} dir="auto" maxLength={120} /></label>
            <label>{labelFor("Contact email")}<input type="email" name="contactEmail" defaultValue={profile.contactEmail ?? ''} maxLength={254} /></label>
            <p className="dim">{labelFor("Permanent identifier:")} <code>{profile.slug}</code></p>
            <button type="submit">{labelFor("Save profile")}</button>
          </form> : <div><strong>{profile.displayName}</strong><p className="dim">{profile.nameAr ?? ''} · {profile.contactEmail ?? ''}</p></div>}
        </section>}
      </Loaded>
      {mayAddPeople ? <section className="panel" style={{ marginBottom: 18 }}>
        <h2 className="sec" style={{ marginTop: 0 }}>{labelFor("Invite a colleague by email")}</h2>
        <p className="dim">{labelFor("A secure, single-use link that expires after 72 hours. Amazon SES email delivery must be configured.")}</p>
        <form action="/api/onboarding" method="post" style={{ display: 'grid', gap: 10, maxWidth: 500 }}>
          <input type="hidden" name="action" value="invite" />
          <input type="hidden" name="lang" value={lang} />
          <label>{labelFor("Email address")}<input name="email" type="email" required maxLength={254} /></label>
          <label>{labelFor("Role")}
            <select name="role" required>{ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{(lang === 'ar' ? ROLE_LABELS[r]?.ar : ROLE_LABELS[r]?.en) ?? r}</option>)}</select>
          </label>
          <button type="submit">{labelFor("Send invitation")}</button>
        </form>
        <Loaded load={api.workspaceInvitations}>
          {(invites) => invites.length ? <div style={{ marginTop: 18 }}>
            <h3>{labelFor("Recent invitations")}</h3>
            <div className="design-table-scroll" role="region" aria-label={labelFor("Recent invitations")} tabIndex={0}><table><thead><tr><th>{labelFor("Email")}</th><th>{labelFor("Role")}</th><th>{labelFor("Status")}</th><th>{labelFor("Action")}</th></tr></thead>
              <tbody>{invites.map(i => <tr key={i.id}><td>{i.email}</td>
                <td>{(lang === 'ar' ? ROLE_LABELS[i.role]?.ar : ROLE_LABELS[i.role]?.en) ?? i.role}</td>
                <td>{i.consumedAt ? (labelFor("Accepted")) : i.revokedAt ? (labelFor("Revoked")) : i.deliveryStatus}</td>
                <td>{!i.revokedAt && !i.consumedAt ? <form action="/api/onboarding" method="post">
                  <input type="hidden" name="action" value="revoke" /><input type="hidden" name="id" value={i.id} />
                  <button type="submit">{labelFor("Revoke")}</button>
                </form> : null}</td></tr>)}</tbody></table></div>
          </div> : <p className="dim">{labelFor("No invitations yet.")}</p>}
        </Loaded>
      </section> : <p className="dim">{labelFor("Only authorized workspace administrators can invite members.")}</p>}
      <Loaded load={api.settings}>
        {(d) => (
          <>
            <div className="tiles">
              <div className="tile"><span>{t('Members')}</span><strong>{d.counts.members}</strong></div>
              <div className="tile"><span>{t('Projects')}</span><strong>{d.counts.projects}</strong></div>
              <div className="tile"><span>{t('Custom fields')}</span><strong>{d.counts.customFields}</strong></div>
              <div className="tile"><span>{t('Active automations')}</span><strong>{d.counts.automations}</strong></div>
              <div className="tile"><span>{t('Connected systems')}</span><strong>{d.counts.integrations}</strong></div>
            </div>

            <h2 className="sec">{t('Workspace')}</h2>
            <div className="design-table-scroll" role="region" aria-label={labelFor("Workspace details")} tabIndex={0}><table>
              <tbody>
                <tr><td style={{ width: 200 }}><strong>{labelFor("Name")}</strong></td><td>{d.tenant.name}</td></tr>
                <tr><td><strong>{t('Identifier')}</strong></td><td><code>{d.tenant.slug}</code></td></tr>
                <tr><td><strong>{t('Created')}</strong></td><td>{when(d.tenant.createdAt, locale)}</td></tr>
                <tr><td><strong>{t('Data isolation')}</strong></td>
                    <td><span className="pill on_track">{labelFor("enforced by the database")}</span>
                      <div className="dim">{t('No query from this workspace can return another workspace’s rows.')}</div></td></tr>
              </tbody>
            </table></div>

            <h2 className="sec">{t('Members')}</h2>
            <div className="design-table-scroll" role="region" aria-label={labelFor("Workspace members")} tabIndex={0}><table>
              <thead><tr><th>{t('Name')}</th><th>{t('Email')}</th><th>{t('Role')}</th></tr></thead>
              <tbody>{d.members.map((m: any) => (
                <tr key={m.email}>
                  <td><strong>{m.name}</strong></td>
                  <td className="dim">{m.email}</td>
                  {/* The role's own name, not its database value — "governance_risk"
                      is how it is stored, not what it is called. */}
                  <td><span className="pill s-closed">
                    {(lang === 'ar' ? ROLE_LABELS[m.role]?.ar : ROLE_LABELS[m.role]?.en)
                      ?? m.role.replace(/_/g, ' ')}</span></td>
                </tr>))}</tbody>
            </table></div>

            <h2 className="sec">{t('What your role can do')}</h2>
            <p className="dim" style={{ marginTop: '-8px' }}>
              {t('You are signed in as')} <strong>{(lang === 'ar'
                ? ROLE_LABELS[d.yourRole as keyof typeof ROLE_LABELS]?.ar
                : ROLE_LABELS[d.yourRole as keyof typeof ROLE_LABELS]?.en) ?? d.yourRole.replace(/_/g, ' ')}</strong>.
              {' '}{labelFor("Permissions are checked per capability, never per role — which is why adding a role never means rewriting a permission check.")}
            </p>
            <div className="design-table-scroll" role="region" aria-label={labelFor("Current role capabilities")} tabIndex={0}><table>
              <thead><tr><th>{t('Capability')}</th><th>{t('What it allows')}</th><th>{t('You')}</th></tr></thead>
              <tbody>{Object.entries(CAP_MEANING).map(([cap, meaning]) => {
                const has = d.yourCapabilities.includes(cap);
                return (
                  <tr key={cap}>
                    <td><code>{cap}</code></td>
                    <td className="dim">{t(meaning)}</td>
                    <td>{has ? <span className="pill on_track">{t('yes')}</span>
                             : <span className="pill s-closed">{t('no')}</span>}</td>
                  </tr>);
              })}</tbody>
            </table></div>
          </>
        )}
      </Loaded>
    </Page>
  );
}
