import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/api';
import { tr, getFrontendLocale } from '@/lib/i18n';
import { navigationArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { UniversalLocaleSwitch } from '@/components/UniversalLocaleSwitch';

export const metadata = { title: 'Sign in · The EPMO' };

export default async function LoginPage({ searchParams }:
  { searchParams: Promise<{ error?: string }> }) {
  const s = await getSession();
  if (s.authenticated) redirect('/');

  const { error } = await searchParams;
  const t = await tr();
  const locale = await getFrontendLocale();
  const labelFor = (english: string) => uiLabel(english, locale, navigationArabic(english));
  const showHint = process.env.NODE_ENV === 'development' &&
    (!process.env.DEPLOYMENT_ENV || process.env.DEPLOYMENT_ENV === 'development');

  return (
    <div className="authwrap">
      <div className="authpanel">
        <div className="brand" style={{ padding: 0, marginBlockEnd: 26 }}>
          <span className="glyph">E</span><span className="wordmark">{labelFor("The EPMO")}</span>
        </div>
        <div className="locale-login-control"><UniversalLocaleSwitch locale={locale} /></div>
        <h1>{labelFor("Sign in")}</h1>
        <p className="sub" style={{ marginBlockEnd: 22 }}>
          {labelFor("Governance for portfolios, programmes and projects.")}
        </p>

        {/* A plain POST: works without JavaScript and cannot go stale. */}
        <form className="authform" method="post" action="/api/session">
          <label>
            {labelFor("Username or email")}
            <input name="identifier" type="text" autoComplete="username" required autoFocus
                   placeholder={labelFor("username or you@company.com")} />
          </label>
          <label>
            {labelFor("Password")}
            <input name="password" type="password" autoComplete="current-password" required
                   placeholder="••••••••" />
          </label>
          {error && <p className="formerr" role="alert">{t(error)}</p>}
          <button className="btn wide" type="submit">{labelFor("Sign in")}</button>
          <Link href="/forgot-password">{labelFor("Forgot password?")}</Link>
        </form>

        {showHint && (
          <div className="hint">
            <strong>{labelFor("Development accounts")}</strong>
            <table>
              <tbody>
                <tr><td><code>ankit_aetherix</code></td><td>{labelFor("owner · both workspaces")}</td></tr>
                <tr><td><code>fatima@al-nakheel.test</code></td><td>{labelFor("owner · Al-Nakheel")}</td></tr>
                <tr><td><code>pm@pmoalign.test</code></td><td>{labelFor("consultant · Al-Nakheel")}</td></tr>
                <tr><td><code>khalid@nexa.test</code></td><td>{labelFor("owner · Nexa")}</td></tr>
              </tbody>
            </table>
            <p>{labelFor("The seeded accounts use ")}<code dir="ltr">pmoalign-dev</code>{labelFor(". The owner account keeps its own password — it is never printed here and a reseed does not reset it.")}</p>
          </div>
        )}
      </div>
      <aside className="authside">
        <blockquote>
          {labelFor("“A project cannot skip a gate, a decision cannot lack an owner, and a report cannot go stale — because the platform will not allow it.”")}
        </blockquote>
      </aside>
    </div>
  );
}
