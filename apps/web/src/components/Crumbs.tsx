'use client';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { navigationArabic } from '@pmo/contracts';
import { uiLabel } from '@/lib/ui-labels.mjs';
import type { FrontendLocale } from '@/lib/frontend-locale.mjs';

const matchesNavPath = (path: string, href: string) =>
  href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);

/** The displayed language comes from one catalog; Arabic isn't duplicated here. */
export function Crumbs({ ar, locale = 'en-US' }: { ar: boolean; locale?: FrontendLocale }) {
  const path = usePathname();
  const labelFor = (english: string) => uiLabel(english, locale, navigationArabic(english));
  const standalone: Record<string, string> = {
    '/decision-cockpit': 'Executive Decision Cockpit',
    '/operations-preview': 'Operations preview',
  };
  let group = '';
  let label = labelFor(path === '/' ? 'Executive Overview' : (standalone[path] ?? 'Current page'));
  for (const g of NAV) {
    for (const i of g.items) {
      if (matchesNavPath(path, i.href)) {
        group = labelFor(g.label);
        label = labelFor(i.label);
      }
    }
  }
  return (
    <nav className="crumbs" dir={locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr'} aria-label={labelFor('Breadcrumb')}>
      <span>{labelFor('The EPMO')}</span>
      {group && <><span className="sep" aria-hidden="true">/</span><span>{group}</span></>}
      <span className="sep" aria-hidden="true">/</span><b aria-current="page">{label}</b>
    </nav>
  );
}
