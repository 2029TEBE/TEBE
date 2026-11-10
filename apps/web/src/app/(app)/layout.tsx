import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession, api, SESSION_COOKIE } from '@/lib/api';
import { NAV } from '@/lib/nav';
import { can, NAV_MODULE, navigationArabic, type Capability } from '@pmo/contracts';
import { TenantSwitcher } from '@/components/TenantSwitcher';
import { UniversalLocaleSwitch } from '@/components/UniversalLocaleSwitch';
import { getFrontendLocale } from '@/lib/i18n';
import { uiLabel } from '@/lib/ui-labels.mjs';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Cursor } from '@/components/Cursor';
import { AskWidget } from '@/components/AskWidget';
import { RailToggle } from '@/components/RailToggle';
import { CommandPalette } from '@/components/CommandPalette';
import { NavLink } from '@/components/NavLink';
import { RailGroup } from '@/components/RailGroup';
import { Crumbs } from '@/components/Crumbs';
import { MobileNav } from '@/components/MobileNav';

/** Everything inside this group requires a signed-in session. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const jar = await cookies();
  if (!session.authenticated) {
    /*
     * A cookie that is present but no longer resolves is an ended session,
     * not a first visit — almost always the idle window closing. Saying so
     * is the difference between "you were signed out after a while away" and
     * being dumped on a login screen for no visible reason.
     */
    const ended = Boolean(jar.get(SESSION_COOKIE));
    redirect(ended
      ? `/login?error=${encodeURIComponent('You were signed out after a period of inactivity. Please sign in again.')}`
      : '/login');
  }

  const locale = await getFrontendLocale();
  const ar = locale === 'ar';
  const rtl = locale === 'ar' || locale === 'ur';
  const caps = (session.capabilities ?? ['read']) as Capability[];

  // A screen appears only if the person has the capability AND the workspace
  // is licensed for the module that owns it. The API enforces the same rule,
  // so hiding the link is a convenience, not the control.
  let enabledModules: string[] = ['core360'];
  try { enabledModules = await api.enabledModules(); } catch { /* API down */ }
  const licensed = (key: string) => {
    const mod = NAV_MODULE[key];
    return !mod || mod === 'core360' || enabledModules.includes(mod);
  };

  const allowed = (i: { cap: Capability; key: string }) => can(caps, i.cap) && licensed(i.key);
  const groups = NAV
    .map((g) => ({ ...g, items: g.items.filter(allowed) }))
    .filter((g) => g.items.length > 0);
  const commands = groups.flatMap((g) => g.items.map((i) => ({
    label: uiLabel(i.label, locale, navigationArabic(i.label)), href: i.href, group: uiLabel(g.label, locale, navigationArabic(g.label)),
  }))); // show and search the group in the selected language too

  const rail = (
    <>
      {/* Their wordmark treatment: no icon, the second half in the brand mint. */}
      <div className="brand"><span className="wordmark">{uiLabel('The EPMO', locale, 'المكتب التنفيذي لإدارة المشاريع')}</span></div>
      <RailToggle />
      {groups.map((g) => (
        <RailGroup key={g.key} label={uiLabel(g.label, locale, navigationArabic(g.label))} hrefs={g.items.map((i) => i.href)}>
          {g.items.map((i) => (
            <NavLink key={i.href} href={i.href} navKey={i.key}>{uiLabel(i.label, locale, navigationArabic(i.label))}</NavLink>
          ))}
        </RailGroup>
      ))}
    </>
  );

  return (
    <div className="shell" dir={rtl ? 'rtl' : 'ltr'} lang={locale}>
      <a className="skiplink" href="#main">{uiLabel('Skip to content', locale, 'تخطَّ إلى المحتوى')}</a>
      <nav className="rail" aria-label={uiLabel('Modules', locale, 'الوحدات')}>{rail}</nav>
      <div>
        <header className="topbar">
          <MobileNav ar={ar}>{rail}</MobileNav>
          <Crumbs ar={ar} locale={locale} />
          <div className="spacer" />
          <CommandPalette commands={commands} lang={locale === 'ar' ? 'ar' : 'en'} />
          <UniversalLocaleSwitch locale={locale} />
          <ThemeToggle locale={locale} />
          <TenantSwitcher session={session} lang={ar ? 'ar' : 'en'} />
        </header>
        <main id="main" tabIndex={-1}><div className="page">{children}</div></main>
        <Cursor />
        <AskWidget lang={ar ? 'ar' : 'en'} enabled={enabledModules.includes('ai360') && can(caps, 'pmoa_view_financials')} />
      </div>
    </div>
  );
}
