'use client';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';

/** Match complete path segments, not overlapping route prefixes. */
const matchesNavPath = (path: string, href: string) =>
  href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);

export function Crumbs({ ar }: { ar: boolean }) {
  const path = usePathname();
  // A few signed-in pages are intentionally outside the licensed NAV groups.
  // Never describe an unlisted page as the Executive Overview by default.
  const standalone: Record<string, [string, string]> = {
    '/decision-cockpit': ['Executive Decision Cockpit', 'مركز القرارات التنفيذي'],
    '/operations-preview': ['Operations preview', 'معاينة عمليات المنصة'],
  };
  let group = '';
  let label = path === '/'
    ? (ar ? 'النظرة التنفيذية' : 'Executive Overview')
    : (standalone[path]?.[ar ? 1 : 0] ?? (ar ? 'الصفحة الحالية' : 'Current page'));
  for (const g of NAV) {
    for (const i of g.items) {
      const hit = matchesNavPath(path, i.href);
      if (hit) { group = ar ? g.ar : g.label; label = ar ? i.ar : i.label; }
    }
  }
  return (
    <nav className="crumbs" aria-label={ar ? 'مسار الصفحة' : 'Breadcrumb'}>
      <span>{ar ? 'المكتب التنفيذي لإدارة المشاريع' : 'The EPMO'}</span>
      {group && <><span className="sep" aria-hidden="true">/</span><span>{group}</span></>}
      <span className="sep" aria-hidden="true">/</span><b aria-current="page">{label}</b>
    </nav>
  );
}
